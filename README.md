*This is not an official Google product*

# ML API next talk demos

This repo includes 3 demos from my [Google Next talk](https://youtu.be/w1xNTLH1zlA) on the ML APIs. To run the demos, follow the instructions below.

## Speech API

1. `cd` into `speech/`
2. Make sure you have [SoX](http://sox.sourceforge.net/) installed. On a Mac: `brew install sox --with-flac`
3. Run the script: `bash request.sh`

## Natural Language API

1. `cd` into `natural-language/`
2. Generate [Twitter Streaming API](https://dev.twitter.com/streaming/overview) credentials and copy them to `local.json`
3. Create a Google Cloud project, generate a JSON keyfile, and add the filepath to `local.json`
4. Create a BigQuery dataset and table, add them to `local.json`
5. Generate an API key and add it to `local.json`
6. Change line 37 to filter tweets on whichver terms you'd like
7. Run the script: `node twitter.js`

## Multiple API demo

1. `cd` into `vision-speech-nl-translate`
2. Make sure you've set up your [GOOGLE_APPLICATION_CREDENTIALS](https://developers.google.com/identity/protocols/application-default-credentials) with a Cloud project that has the Vision, Speech, NL, and Translation APIs enabled
3. Run the script: `python textify.py`
4. Note: if you're running it with image OCR, copy an image file to your local directory