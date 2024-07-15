Package manager with add and install functionality written in NodeJS with the Express framework.

cd into ./backend folder and execute: "npm run dev"

npm run dev is configured to be used with nodemon, so it will automatically restart when changes are made. This may cause issues with 
a port being accessed by another process if running on seperate terminal. Run fuser -k "{port number}"/tcp to kill the process.

To verify packages are being added and installed correctly, there is a commented out "test" at the bottom of npmFetch.js to test is-thirteen functionallity. Simply run the add command then enter "is-thirteen" and then run install. Uncommenting the lines will return the correct answer.