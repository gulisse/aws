/*********************************************************************************************************************
 *  Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

/**
 * Lib
 */
let AWS = require('aws-sdk');
let Profile = require('./profile.js');
let AccessLog = require('./access-log.js');
const servicename = 'data-lake-profile-service';

/**
 * Verifies user's authorization to execute requested action. If the request is
 * authorized, it is processed, otherwise a 401 unathorized result is returned
 * @param {JSON} event - Request event.
 * @param {respond~requestCallback} cb - The callback that handles the response.
 */
module.exports.respond = function(event, cb) {

    // 2017-02-18: hotfix to accomodate API Gateway header transformations
    let _authToken = '';
    if (event.headers.Auth) {
        console.log(['Header token post transformation:', 'Auth'].join(' '));
        _authToken = event.headers.Auth;
    } else if (event.headers.auth) {
        console.log(['Header token post transformation:', 'auth'].join(' '));
        _authToken = event.headers.auth;
    }

    let _authCheckPayload = {
        authcheck: ['Admin', 'Member'],
        authorizationToken: _authToken
    };

    let _response = '';

    // invoke data-lake-admin-service function to verify if user has
    // proper role for requested action
    let params = {
        FunctionName: 'data-lake-admin-service',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: JSON.stringify(_authCheckPayload)
    };
    let lambda = new AWS.Lambda();
    lambda.invoke(params, function(err, data) {
        if (err) {
            console.log(err);
            _response = buildOutput(500, err);
            return cb(_response, null);
        }

        let _ticket = JSON.parse(data.Payload);
        console.log('Authorization check result:' + _ticket.auth_status);
        if (_ticket.auth_status === 'authorized') {
            processRequest(event, _ticket, cb);
        } else {
            logAccessEvent(event.requestContext.requestId, ticket.userid, 'access user profile',
                'failed/unauthorized',
                function(err, resp) {
                    _response = buildOutput(401, {
                        error: {
                            message: 'User is not authorized to perform the requested action.'
                        }
                    });
                    return cb(_response, null);
                });
        }
    });
};

/**
 * Routes the request to the appropriate logic based on the request resource and method.
 * @param {JSON} event - Request event.
 * @param {JSON} ticket - Data lake authorization ticket.
 * @param {processRequest~requestCallback} cb - The callback that handles the response.
 */
function processRequest(event, ticket, cb) {

    let INVALID_PATH_ERR = {
        Error: ['Invalid path request ', event.resource, ', ', event.httpMethod].join('')
    };

    let _profile = new Profile();
    let _accessLog = new AccessLog();
    let _response = '';

    let _body = {};
    let _operation = '';
    if (event.body) {
        _body = JSON.parse(event.body);
    }

    if (event.resource === '/profile' && event.httpMethod === 'GET') {
        _operation = 'retrieve user profile information';
        _profile.getProfile(ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/profile/apikey' && event.httpMethod === 'GET') {
        _operation = 'generating a new secret access key';
        _profile.createApiKey(ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else {
        _response = buildOutput(500, INVALID_PATH_ERR);
        return cb(_response, null);
    }

}

/**
 * Constructs the appropriate HTTP response.
 * @param {integer} statusCode - HTTP status code for the response.
 * @param {JSON} data - Result body to return in the response.
 */
function buildOutput(statusCode, data) {

    let _response = {
        statusCode: statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };

    return _response;
}
