const FS = require('fs'); // Temp dependency
const FSE = require('fs-extra');
const READLINE = require('readline');
const HOME = require('os').homedir();
const SWTCH = require('brief-switch');


const CWD = FS.realpathSync(process.cwd());

function check(fn) { // all fs-handy functions have the required first argument
  return (...args) => {
    if (!args[0]) throw new Error('fs-handy: first argument is required');
    else return fn.apply(this, args);
  };
}


// PROMISIFIED FUNCTIONS
function checkFileExistence(path, existCallback, absentCallback) {
  if (existCallback) {
    if (!absentCallback) throw new Error('fs-handy: all arguments are required');
    else {
      slave(existCallback, absentCallback);
      return this;
    }
  } else {
    return new Promise(slave);
  }

  function slave(resolve, reject) {
    FS.stat(path, (err) => {
      if (!err) resolve(path); // ------------------------> exit (file exists)
      else if (err.code === 'ENOENT') reject(path); // ---> exit (file does not exist)
      else throw err;
    });
  }
}
function readFile(path, successCallback, errCallback) {
  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    FS.readFile(path, 'utf8', (err, data) => {
      if (err) {
        return reject && reject(err); // ---> exit (unable to read file)
      }
      return resolve(data);  // ------------> exit (file data goes outside)
    });
  }
}
function writeFile(path, text, successCallback, errCallback) {
  const data = text || '';

  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    FSE.outputFile(path, data, (err) => {
      if (err) {
        const error = err;
        error.message = `fs-handy: unable to write file "${path}"`;
        return reject && reject(error); // ---> exit (unable to write file)
      }
      return resolve(data); // ----> exit (file is successfully written)
    });
  }
}
function remove(path, successCallback, errCallback) {
  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    FSE.remove(path, (err) => {
      if (err) {
        const error = err;
        error.message = `fs-handy: unable to remove "${path}"`;
        return reject && reject(error); // --------------------> exit
      }
      return resolve(true); // ----> exit (file of folder is successfully removed)
    });
  }
}
function appendToFile(path, text, successCallback, errCallback) {
  const data = text || '';

  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    FS.appendFile(path, data, (err) => {
      if (err) {
        const error = err;
        error.message = `fs-handy: unable to append file "${path}"`;
        return reject && reject(error); // ----> exit (unable to append file)
      }
      return resolve && resolve(data); // ---> exit (file is successfully appended)
    });
  }
}
function readOrMakeFile(path, makeFunctionOrString, successCallback, errCallback) {
  const argType = typeof makeFunctionOrString;
  const makeCallback = SWTCH(argType, [
    'function', makeFunctionOrString,
    'string',   res => res(makeFunctionOrString),
    res => res(''),
  ]);


  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    checkFileExistence(
      path,
      // ---> exit (file is exist and will be read)
      () => readFile(path, resolve, reject),
      // ---> makeCallback will return the content
      () => makeCallback(writeCallback, reject)
    );

    function writeCallback(content) {
      writeFile(
        path,
        content,
        resolve, // ---> exit (new file is created with the content provided by makeCallback)
        reject // ---> exit (something went wrong)
      );
    }
  }
}
function makeDirectories(path, successCallback, errCallback) {
  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);


  function slave(resolve, reject) {
    FSE.ensureDir(path, (err) => {
      if (err) {
        if (reject) reject(err);
        else throw new Error(`fs-handy: unable to make a directory "${path}"`);
      } else {
        resolve(path);
      }
    });
  }
}

function getConfig(path, defProvider, CLIQuestions, successCallback, errCallback) {
  /*
  const CLIQuestions_EXAMPLE = [
    { prop: 'pathToBase',       question: 'Full path to database file:' },
    { prop: 'pathToNotefile',   question: 'Path to temp file:' },
    { prop: 'editor',           question: 'Command to open your text editor:' },
  ];
  */
  const CLIAnswers = {};

  if (successCallback) {
    slave(successCallback, errCallback);
    return this;
  }
  return new Promise(slave);

  function slave(resolve, reject) {
    readOrMakeFile(
      path,
      createConfig,
      checkConfigReadability,
      reject
    );

    function checkConfigReadability(content) {
      try {
        const parsedConfig = JSON.parse(content);
        process.nextTick(() => resolve(parsedConfig)); // ---------> exit
      } catch (err) {
        // What to do with the broken Config?
        if (reject) reject(err); // -------> exit with error (incorrect JSON)
        else throw new Error('fs-handy: config-file contains incorrect JSON');
      }
    }
    function createConfig(returnResults, returnError) {
      if (CLIQuestions) ask();
      else assignDefaults({});

      function ask() {
        const rl = READLINE.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        let currentLine = CLIQuestions.shift();
        if (!currentLine) returnError('fs-handy: CLI Error');


        rl.question(`${currentLine.question} \n`, answerCallback);


        function answerCallback(answer) {
          if (answer) CLIAnswers[currentLine.prop] = answer; // Results

          if (CLIQuestions.length) {
            currentLine = CLIQuestions.shift();
            rl.question(`${currentLine.question} \n`, answerCallback);
          } else {
            rl.close();
            assignDefaults(CLIAnswers); // CLI finish
          }
        }
      }
      function assignDefaults(CLIanswers) {
        // defProvider may be a function or an object
        if (typeof defProvider === 'function') {
          // defProvider is a function that returns a default config object or parseable string
          Promise.resolve(defProvider()).then((defValue) => {
            const defaults = (typeof defValue === 'object')
              ? defValue
              : JSON.parse(defValue);

            assign(defaults, CLIanswers);
          });
        } else {
          assign(defProvider, CLIanswers);
        }

        function assign(def, cli) {
          const configResult = Object.assign(def, cli);
          returnResults(JSON.stringify(configResult, null, 2));
        }
      }
    }
  }
}

// NOT PROMISIFIED
function detectFileChanges(path, callback) {
  if (!callback) throw new Error('fs-handy: "callback" is required');

  let timer;
  FS.watch(path, () => {
    if ((timer) && (!timer._called)) return; // Removes duplicated fire (FS.watch bug)
    timer = setTimeout(callback, 30); // ---> exit (file was changed -> 30ms -> callback execution)
  });
}

module.exports = {
  HOME,
  CWD,
  fse: FSE,

  check:      check(checkFileExistence),
  read:       check(readFile),
  write:      check(writeFile),
  rm:         check(remove),
  append:     check(appendToFile),
  rom:        check(readOrMakeFile),
  dir:        check(makeDirectories),

  watch:      check(detectFileChanges),
  getConfig:  check(getConfig),
};
