const { app, BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')
const settings = require('electron-settings')
const _ = require('lodash')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  let windowState = {}
  try {
    windowState = settings.get('windowstate') || {}
  } catch (err) {
    // the file is there, but corrupt. Handle appropriately.
  }

  // Create the browser window.
  win = new BrowserWindow({
    x: windowState.bounds && windowState.bounds.x,
    y: windowState.bounds && windowState.bounds.y,
    width: windowState.bounds && windowState.bounds.width || 1200,
    height: windowState.bounds && windowState.bounds.height || 900,
  })

  if (windowState.isMaximized) {
    win.maximize()
  }

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  //win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })

  ;['resize', 'move', 'close'].forEach(e => {
    win.on(e, _.throttle(() => {
      windowState.isMaximized = win.isMaximized()

      if (!windowState.isMaximized) {
        // only update bounds if the window isn't currently maximized
        windowState.bounds = win.getBounds()
      }

      settings.set('windowstate', windowState)
    }, 500))
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
