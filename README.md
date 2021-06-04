# AWS Flutter device farm
Automatize aws device farm from flutter appium


# Dependencies
## NODEJS
MacOS: https://formulae.brew.sh/formula/node

Windows/Linux: https://nodejs.org/en/download/

## AWS CLI
Install AWS Command Line Interface (AWS CLI)

MacOS/Linux:
```
curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip"
unzip awscli-bundle.zip
sudo ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
``` 

Windows:
```
pip install  awscli 
```

For alternative install options see:  
https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html

## AWS CLI Credentials
Configure the AWS CLI credentials:
```
$ aws configure
AWS Access Key ID [None]: <YOUR KEY>
AWS Secret Access Key [None]: <YOUR KEY>
Default region name [None]: us-west-2 <DON`T CHANGE THIS>
Default output format [None]: json <DON`T CHANGE THIS>
```
For alternative configuration options see:  
https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html

## Test AWS CLI
Confirm AWS CLI is installed and configured correctly by running an AWS command. For example, the following command should generate output:
```
aws devicefarm list-projects
```

# Installation
```
npm install -g aws-device-farm-flutter
```
##### OR

```
npm install -g git+https://github.com/michaelopes/aws-device-farm-flutter.git
```

# Usage adff
```
'-i, --apk_absolute_path <path>', 'Path to the android APK file <REQUIRED IF ipa_absolute_path IS EMPTY>
'-I, --ipa_absolute_path <path>', 'Path to the iOS IPA file' <REQUIRED IF apk_absolute_path IS EMPTY>
'-d, --device_pool_name <name>', 'ARN of the AWS Device Pool used for tests' <OPTIONAL>
'-p, --project_name <name>', 'Name of the AWS Device Farm project' <REQUIRED>
'-a, --appium_node_absolute_path <path>', 'Path to the appium tests folder' <REQUIRED>
```

# Example to usage adff
```
adff --appium_node_absolute_path '/path/to/appium/nodejs/test_appium' --project_name MyProject --apk_absolute_path '/path/to/apk/app-dev-debug.apk'
```
