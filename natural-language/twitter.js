// Copyright 2018 Google Inc.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
const request = require('request');
const Twitter = require('twitter');
const async = require('async');
const config = require('./local.json');
const client = new Twitter(config.twitter);

// Set up BigQuery
// Replace this with the name of your project and the path to your keyfile
const bigquery = require('@google-cloud/bigquery')({
  projectId: config.cloud_project_id
});
const dataset = bigquery.dataset(config.bigquery_dataset);
const table = dataset.table(config.bigquery_table);

// Replace searchTerms with whatever tweets you want to stream
// Details here: https://dev.twitter.com/streaming/overview/request-parameters#track
const searchTerms = '#googlenext17,@googlecloud,google cloud';

function callNLMethod(tweet, method) {
	const textUrl = `https://language.googleapis.com/v1/documents:${method}?key=${config.nl_api_key}`;
	let requestBody = {
			"document": {
					"type": "PLAIN_TEXT",
					"content": tweet.text
			}
	}
	
	let options = {
			url: textUrl,
			method: "POST",
			body: requestBody,
			json: true
	}

	return new Promise((resolve, reject) => {
			request(options, function(err, resp, body) {
					if ((!err && resp.statusCode == 200) && (body.sentences.length != 0)) {
							resolve(body);
					} else {
							reject(err);
					}
			});
	})
}

client.stream('statuses/filter', {track: searchTerms, language: 'en'}, function(stream) {

  stream.on('data', function(tweet) {
   		if ((tweet.text != undefined) && (tweet.text.substring(0,2) != 'RT')) {
			async function analyzeTweet() {
				try {
					let syntaxData = await callNLMethod(tweet, 'analyzeSyntax');
					let sentimentData = await callNLMethod(tweet, 'analyzeSentiment');

					let row = {
							id: tweet.id_str,
							text: tweet.text,
							created_at: tweet.timestamp_ms.toString(),
							user_followers_count: tweet.user.followers_count,
							hashtags: JSON.stringify(tweet.entities.hashtags),
							tokens: JSON.stringify(syntaxData.tokens),
							score: sentimentData.documentSentiment.score,
							magnitude: sentimentData.documentSentiment.magnitude
					};

					table.insert(row, function(error, insertErr, apiResp) {
							if (error) {
									console.log('err', error);
							} else if (insertErr.length == 0) {
									console.log('success!');
							}
					});

				} catch (err) {
						console.log('API error: ', err);
				}
			}
			analyzeTweet();
   		}

  });

  stream.on('error', function(error) {
    throw error;
  });
});