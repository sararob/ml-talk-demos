'use strict';

const request = require('request');
const Twitter = require('twitter');

const client = new Twitter({
  consumer_key: '2i3riflXOIFZpfvdRm9EgDNiZ',
  consumer_secret: 'Qe13wfGYJ4xLLaZZzmX4AgpijAJfyVZRilp1wKiCWIW6tjHTnr',
  access_token_key: '332018940-XhIf27uJsGMn62Rk6Vutc8fiewfyXJJtP5FHaEqJ',
  access_token_secret: 'IcrjqPLVvvsfDz6iiIypQFMf66NpzOgVccASNTYuZC6Df'
});

// Set up BigQuery
// Replace this with the name of your project and the path to your keyfile
const gcloud = require('gcloud')({
  keyFilename: 'sara-bigquery-3bc492b201f5.json',
  projectId: 'sara-bigquery'
});
const bigquery = gcloud.bigquery();
const dataset = bigquery.dataset('syntax');
const table = dataset.table('debate_1019');

// Replace searchTerms with whatever tweets you want to stream
// Details here: https://dev.twitter.com/streaming/overview/request-parameters#track
const searchTerms = '#googlenext17,@googlecloud,google cloud';

client.stream('statuses/filter', {track: searchTerms, language: 'en'}, function(stream) {

  stream.on('data', function(event) {
		// Exclude tweets starting with "RT"
   		if ((event.text != undefined) && (event.text.substring(0,2) != 'RT')) {
   			// callNLApi(event);
   			console.log(event.text);
   		}

  });

  stream.on('error', function(error) {
    throw error;
  });
});

function callNLApi(tweet) {
	const textUrl = "https://language.googleapis.com/v1beta1/documents:annotateText?key=AIzaSyCkhyTuJoQmmBtixcsOlxqMLj4sAvX4XIo"

	let requestBody = {
		"document": {
			"type": "PLAIN_TEXT",
			"content": tweet.text
		},
		"features": {
		  "extractSyntax": true,
		  "extractDocumentSentiment": true
		}
	}

	let options = {
		url: textUrl,
		method: "POST",
		body: requestBody,
		json: true
	}

	request(options, function(err, resp, body) {
		if ((!err && resp.statusCode == 200) && (body.sentences.length != 0)) {

			let row = {
			  id: tweet.id_str,
			  text: tweet.text,
			  created_at: tweet.timestamp_ms,
			  user_followers_count: (tweet.user.followers_count),
			  hashtags: JSON.stringify(tweet.entities.hashtags),
			  tokens: JSON.stringify(body.tokens),
			  polarity: (body.documentSentiment.polarity).toString(),
			  magnitude: (body.documentSentiment.magnitude).toString(),
			  location: JSON.stringify(tweet.place)
			};

			// table.insert(row, function(error, insertErr, apiResp) {
			// 	// console.log(apiResp.insertErrors[0]);
			// 	if (error) {
			// 		console.log('err', error);
			// 	} else if (insertErr.length == 0) {
			// 		console.log('success!');
			// 	}
			// });


		} else {
			console.log('NL API error: ', err);
		}
	});
}
