const util = require('util')
const cp = require('child_process')
const fs = require('fs')
const path = require('path')
const { remote: { app } } = require('electron')

//const writeFile = util.promisify(fs.writeFile)

const TMP_FILE = `${app.getPath('userData')}/output.json`

/*async*/ function parse (filename) {
  return new Promise((resolve, reject) => {
    cp.exec(`rattletrap decode "${filename}" "${TMP_FILE}"`, function (error, stdout, stderr) {
      if (stderr) {
        reject(stderr)
      }

      const body = fs.readFileSync(path.resolve(TMP_FILE))

      resolve(JSON.parse(body))
    })
  })
  //const { stdout, stderr } = await exec(`${RT} decode ${filename} ${TMP_FILE}`)
}

function filter (tree) {
  return {
    playerStats: getPlayerStats(tree)
  }
}

function getPlayerStats (tree) {
  let players = tree.header.properties.value.PlayerStats.value.array_property

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

function spreadsheet (games, delimiter = '\t') {
  const headers = columns.map(column => {
    return `"${column}"`
  }).join(delimiter)

  const players = games.map(playerStats => {
    return playerStats.sort((a, b) => {
      return (a.Team - b.Team) || (b.Score - a.Score)
    }).map(player => {
      return columns.map(column => {
        let prop = aliases[column]
        if (typeof prop === 'undefined') {
          prop = column
        }
        /*if (typeof value === 'undefined') {
        value = ''
      }*/
        const value = typeof player[prop] === 'undefined' ? '' : player[prop]
        return `"${value}"`
      }).join(delimiter)
    })
  })

  return [headers].concat(flatten(players)).join('\r\n')
}

const inputDirectory = process.argv[2]

module.exports = function (/*inputDirectory,*/inputFiles) {
  /*Promise.all(fs.readdirSync(path.resolve(inputDirectory))*/
  return Promise.all(inputFiles
    .filter(filename => !!filename.match(/\.replay$/))
    .map(f => path.resolve(/*inputDirectory,*/process.cwd, f))
    .map(parse))
    .then(results => {
      const gameStats = results
        .map(filter)
        .map(f => f.playerStats)
      return spreadsheet(gameStats)
    })

}

function flatten (arrays) {
  return arrays.reduce(
    ( acc, cur ) => acc.concat(cur),
    []
  );
}