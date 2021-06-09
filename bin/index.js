#!/usr/bin/env node
const program = require('commander');
const lodash = require('lodash');
const awsIntegration = require('../aws-integration');
const pckg = require('./../package.json')

program
    .version(pckg.version)
    .description('AWS flutter on AWS Device Farm')
    .option('-i, --apk_absolute_path <path>', 'Path to the android APK file')
    .option('-I, --ipa_absolute_path <path>', 'Path to the iOS IPA file')
    .option('-d, --device_pool_name <name>', 'ARN of the AWS Device Pool used for tests')
    .option('-p, --project_name <name>', 'Name of the AWS Device Farm project')
    .option('-a, --appium_node_absolute_path <path>', 'Path to the appium tests folder')
    .parse(process.argv)

const options = program.opts();
const params = {
    nodeTestAbsolutPath: options.appium_node_absolute_path ? options.appium_node_absolute_path.replace(/'/g, '').replace(/"/g, '') : undefined,
    projectName: options.project_name ? options.project_name.replace(/'/g, '').replace(/"/g, '') : undefined,
    devicePoolName: options.device_pool_name ? options.device_pool_name.replace(/'/g, '').replace(/"/g, '') : undefined,
    apkAbsolutePath: options.apk_absolute_path ? options.apk_absolute_path.replace(/'/g, '').replace(/"/g, '') : undefined,
    ipaAbsolutePath: options.ipa_absolute_path ? options.ipa_absolute_path.replace(/'/g, '').replace(/"/g, '') : undefined
}
awsIntegration.mainFunc(params);