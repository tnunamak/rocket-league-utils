const util = require('util')
const cp = require('child_process')
const fs = require('fs')
const path = require('path')
const { remote: { app } } = require('electron')

//const writeFile = util.promisify(fs.writeFile)
const includeFilename = false

const TMP_FILE = `${app.getPath('userData')}/output.json`

/*async*/ function parse (filename, rattletrapPath = 'rattletrap') {
  return new Promise((resolve, reject) => {
    cp.exec(`"${rattletrapPath}" --compact --input "${filename}" --output "${TMP_FILE}"`, function (error, stdout, stderr) {
      if (stderr) {
        reject(stderr)
      }

      try {
        const body = fs.readFileSync(path.resolve(TMP_FILE))

        resolve(JSON.parse(body).header.body.properties)
        fs.unlinkSync(TMP_FILE)
      }
      catch (e) {
        reject('Could not read or clean up processing files, they probably failed to be created.')
      }
    })
  })
  //const { stdout, stderr } = await exec(`${RT} decode ${filename} ${TMP_FILE}`)
}

function filter (tree) {
  return {
    playerStats: getPlayerStats(tree),
    teamStats: getTeamStats(tree)
  }
}

function getTeamStats (tree) {
  let {
    Team0Score,
    Team1Score
  } = getValues(tree)

  return { 0: Team0Score || 0, 1: Team1Score || 0 }
}

function getPlayerStats (tree) {
  let players = tree.value.PlayerStats.value.array

  players = players.map(player => {
    // TODO
    // const player = _.cloneDeep(player)

    player = getValues(player)
    player.Platform = player.Platform[player.Platform.length - 1]
    return player
  })

  return players
  //console.log(JSON.stringify(players, null, '\t'))
}

function getValues (o) {
  const mapped = {}

  o.keys.forEach(k => {
    const wrapped = o.value[k].value

    if (Object.keys(wrapped).length !== 1) {
      console.warn(`Expected a property to have one key, but it looks like:\n${JSON.stringify(wrapped)}`)
    }

    mapped[k] = wrapped[Object.keys(wrapped)[0]]
  })

  return mapped
}

const columns = [
  'Name', 'Team', /*'MVPs',*/ 'Pts', 'Goals', 'Assists', 'Saves', 'Shots'
]

const aliases = {
  Pts: 'Score'
}

function spreadsheet (games, paths, delimiter = '\t') {
  let headers = columns.map(column => {
    return `"${column}"`
  })

  if (includeFilename) {
    headers = headers.concat('"Filename"')
  }

  headers = headers.join(delimiter)

  const players = games.map(({ teamStats, playerStats }, i) => {
    return playerStats.sort((a, b) => {
      return (teamStats[b.Team] - teamStats[a.Team]) ||
        (b.Score - a.Score) ||
        // MVP ties are resolved alphabetically
        (b.Name < a.Name ? 1 : -1)
    }).map(player => {
      let values = columns.map(column => {
        let prop = aliases[column]
        if (typeof prop === 'undefined') {
          prop = column
        }
        /*if (typeof value === 'undefined') {
        value = ''
      }*/
        const value = typeof player[prop] === 'undefined' ? '' : player[prop]
        return `"${value}"`
      })
      if (includeFilename) {
        values = values.concat(`"${path.basename(paths[i])}"`)
      }
      return values.join(delimiter)
    })
  })

  return [headers].concat(flatten(players)).join('\r\n')
}

const inputDirectory = process.argv[2]

function parseFiles (/*inputDirectory,*/inputFiles, rattletrapPath, notifyFileCompletedFn) {
  /*Promise.all(fs.readdirSync(path.resolve(inputDirectory))*/

  const paths = inputFiles
    .filter(filename => !!filename.match(/\.replay$/))
    .map(f => path.resolve(/*inputDirectory,*/process.cwd, f))

  // Serially parse each path and add the results to an array that this 
  // promise resolves with.
  const resultsPromise = paths.reduce((memo, path) => {
    return memo.then(results => {
      return parse(path, rattletrapPath)
        .then(singleResult => {
          notifyFileCompletedFn(path)
          results.push(singleResult)
          return Promise.resolve(results)
        })
    })
  }, Promise.resolve([]))

  return resultsPromise 
    .then(results => {
      const gameStats = results
        .map(filter)
      return spreadsheet(gameStats, paths)
    })
}

module.exports = function (inputFiles, rattletrapPath) {
  const job = {
    promise: parseFiles(inputFiles, rattletrapPath, () => job.numberCompleted++),
    numberCompleted: 0
  }

  return job
}

function flatten (arrays) {
  return arrays.reduce(
    ( acc, cur ) => acc.concat(cur),
    []
  );
}
