#!/bin/bash

ver=`cat package.json | grep version | cut -d: -f2 | sed -e "s/\"//g" | sed -e "s/ //g" | sed -e "s/\,//g"`

rm dist/AWSLambdaRedshiftLoader-$ver.zip

npm install --upgrade

zip -r AWSLambdaRedshiftLoader-$ver.zip index.js common.js createS3TriggerFile.js constants.js kmsCrypto.js upgrades.js *.txt package.json node_modules/async node_modules/uuid node_modules/pg node_modules/https-proxy-agent

mv AWSLambdaRedshiftLoader-$ver.zip dist
