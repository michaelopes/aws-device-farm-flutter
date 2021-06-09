const program = require('commander')
const shell = require("shelljs");
const JSZip = require('jszip');
const fs = require('fs');
const AWS = require('aws-sdk');
const unirest = require('unirest');
const delay = require('delay');
const os = require('os');

const devicefarm = new AWS.DeviceFarm({ region: 'us-west-2' })
const gParams = {
    type: 'APPIUM_NODE_TEST_PACKAGE',
}

var mainFunc = function (mainParams) {
    console.log(os.tmpdir());
    var hasError = false;
    if (!mainParams.nodeTestAbsolutPath) {
        console.error("Test folder is required.");
        hasError = true;
    }

    if (!mainParams.projectName) {
        console.error("Project name is required.");
        hasError = true;
    }

    if (!mainParams.apkAbsolutePath && !mainParams.ipaAbsolutePath) {
        console.error("Application executable .apk or .ipa not found.");
        hasError = true;
    }

    if (hasError) return;

    let osType = mainParams.ipaAbsolutePath ? "IOS_APP" : "ANDROID_APP";

    if (!mainParams.devicePoolName) mainParams.devicePoolName = "Top Devices";

    let project;
    let devicePool;
    let createdExecUpload;
    let createdZipUpload;
    let createdSpecUpload;

    checkAwsCli(function () {
        checkAwsProject(function () {
            shell.exec("npm list -g npm-bundle", function (code, stdout, stderr) {
                if (stdout.indexOf("npm-bundle@") >= 0) {
                    execNpmBundle();
                } else {
                    shell.exec("npm install --global npm-bundle", function (code, stdout, stderr) {
                        if (stderr) console.error('--- Install npm-bundle failed --- ', stderr)
                        else {
                            execNpmBundle();
                        }
                    });
                }
            });
        });
    });

    function checkAwsProject(cb) {
        if (cb instanceof Function) {
            devicefarm.listProjects({}, function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }
                var projects = data.projects;
                project = projects.filter(function (obj) { return obj.name == mainParams.projectName });
                if (project.length) {
                    project = project[0]
                    cb();
                } else {
                    console.error("Project " + mainParams.projectName + " invalid.");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }

    function checkAwsCli(cb) {
        if (cb instanceof Function) {
            shell.exec("aws --version", function (code, stdout, stderr) {
                if (code == 0) {
                    cb();
                } else {
                    console.error("aws-cli is not installed on device");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }

    function selectDevicePool(cb) {
        if (cb instanceof Function) {
            devicefarm.listDevicePools({
                arn: project.arn
            }, function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }
                let pools = data.devicePools;
                let pool = pools.filter(function (obj) { return obj.name == mainParams.devicePoolName });
                if (pool.length) {
                    devicePool = pool[0];
                    cb();
                } else {
                    console.error("Device pool " + mainParams.devicePoolName + " not found.");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }

    //CONTAINER
    function execNpmBundle() {
        shell.exec("cd " + mainParams.nodeTestAbsolutPath + " && npm-bundle", function (code, stdout, stderr) {
            if (stderr) console.error("-- Error --", stderr)
            else {
                console.log("out", stdout);
                zipTgzPackage(stdout.replace("\n", "")).then(function () {
                    selectDevicePool(function () {
                        createExecUpload(function () {
                            fileUpload(createdExecUpload.url, osType == "ANDROID_APP" ? mainParams.apkAbsolutePath : mainParams.ipaAbsolutePath, function () {
                                checkUpload(createdExecUpload.arn, function () {
                                    createZipUpload(function () {
                                        fileUpload(createdZipUpload.url, os.tmpdir() + "/bundle.zip", function () {
                                            checkUpload(createdZipUpload.arn, function () {
                                                createSpecUpload(function () {
                                                    fileUpload(createdSpecUpload.url, __dirname + "/bundle-file.yml", function () {
                                                        checkUpload(createdSpecUpload.arn, function () {
                                                            scheduleRun();
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    }

    function scheduleRun() {

        const paramsScheduleRun = {
            projectArn: project.arn,
            appArn: createdExecUpload.arn,
            devicePoolArn: devicePool.arn,
            name: mainParams.projectName + "TestRun",
            test: {
                testSpecArn: createdSpecUpload.arn,
                type: 'APPIUM_NODE',
                testPackageArn: createdZipUpload.arn
            }
        }

        devicefarm.scheduleRun(paramsScheduleRun, function (err, data) {
            if (err) {
                console.error(err);
                return;
            }
            if (data.run.status == "SCHEDULING") {
                listenRun(data.run);
            } else {
                console.error("Error on schedule run", data);
            }
        });
    }

    async function listenRun(run, counter) {
        if (!counter) counter = 0;
        await delay(10 * 1000);
        devicefarm.getRun({ arn: run.arn }, function (err, data) {
            var counters = data.run.counters;
            if (counter < 60 && data.run.result == "PENDING") {
                counter = counter + 1;
                listenRun(run, counter);
            }
            console.log("STATUS:", data.run.result, data.run.counters);
        })
    }

    async function checkUpload(arn, cb, retry) {
        if (!retry) retry = 0;
        console.log("--- CHECK IF FILE SUCCESFUL UPLOADED " + retry + "---");
        await delay(5 * 1000)
        if (cb instanceof Function) {
            devicefarm.getUpload({ arn: arn }, function (err, data) {
                if (err) {
                    console.log(err);
                    return;
                }
                if (data.upload.status == "SUCCEEDED") {
                    console.log("--- FILE SUCCEDDED UPLOAD ---");
                    cb()
                } else {
                    if (retry > 4) {
                        console.error("An error occured on upload file");
                    } else {
                        retry = retry + 1;
                        checkUpload(arn, cb, retry);
                    }
                }
            })
        } else {
            console.error("Callback is not a Function");
        }
    }

    function zipTgzPackage(tgzFileName) {
        let fullPath = mainParams.nodeTestAbsolutPath + "/" + tgzFileName;
        return new Promise(((resolve, reject) => {
            // Zipping the TGZ
            const zip = new JSZip()
            const tgzPromise = new JSZip.external.Promise((resolve, reject) => {
                fs.readFile(fullPath, function (err, data) {

                    if (err) {
                        console.log('--- Read file err --- ', err)
                        reject(err)
                    } else {
                        console.log('--- Read file ok --- ', data)
                        resolve(data)

                    }
                })
            })
            zip.file(tgzFileName, tgzPromise)
            // Write the zip
            zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(fs.createWriteStream(os.tmpdir() + "/bundle.zip"))
                .on('finish', () => {
                    console.log('--- Write zip ok --- ')
                    resolve('finish')
                    fs.unlinkSync(fullPath);
                })
        }))
    }

    function createExecUpload(cb) {
        if (cb instanceof Function) {
            var executableName;
            if (osType == "ANDROID_APP") {
                executableName = mainParams.apkAbsolutePath.split("/").pop();
            } else {
                executableName = mainParams.ipaAbsolutePath.split("/").pop();
            }

            const paramsCreateUpload = {
                name: executableName,
                type: osType,
                projectArn: project.arn
            }

            devicefarm.createUpload(paramsCreateUpload, function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }
                createdExecUpload = data.upload;
                if (createdExecUpload.status == "INITIALIZED") {
                    cb();
                } else {
                    console.error("Error on create upload on aws device farm.");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }

    function createZipUpload(cb) {
        if (cb instanceof Function) {
            const paramsCreateUpload = {
                name: "bundle.zip",
                type: gParams.type,
                projectArn: project.arn
            }

            devicefarm.createUpload(paramsCreateUpload, function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }
                createdZipUpload = data.upload;
                if (createdZipUpload.status == "INITIALIZED") {
                    cb();
                } else {
                    console.error("Error on create upload on aws device farm.");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }

    function createSpecUpload(cb) {
        if (cb instanceof Function) {
            const paramsCreateUpload = {
                name: "bundle-file.yml",
                type: "APPIUM_NODE_TEST_SPEC",
                projectArn: project.arn
            }

            devicefarm.createUpload(paramsCreateUpload, function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }
                createdSpecUpload = data.upload;
                if (createdSpecUpload.status == "INITIALIZED") {
                    cb();
                } else {
                    console.error("Error on create upload on aws device farm.");
                }
            });
        } else {
            console.error("Callback is not a Function");
        }
    }
}

function fileUpload(url, filePath, cb) {
    console.log("--- INIT FILE UPLOAD ---");
    unirest
        .put(decodeURI(url))
        .headers({ 'Content-Type': 'application/octet-stream' })
        .send(fs.readFileSync(filePath)) // Attachment
        .then(function (response) {
            console.log("--- FINISH FILE UPLOAD ---");
            if (response.status == 200) {
                if (cb instanceof Function) {
                    cb();
                }
            } else {
                console.error("Error on upload file: " + filePath);
            }
        })
}

exports.mainFunc = mainFunc;
