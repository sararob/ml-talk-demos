*This is not an official Google product*

# ML API next talk demos

This repo includes 4 demos from my [Google Next talk](https://youtu.be/w1xNTLH1zlA) and [Google I/O talk](https://www.youtube.com/watch?v=ETeeSYMGZn0) on the Cloud ML APIs. To run the demos, follow the instructions below.

## Vision API

1. `cd` into `vision-api-firebase`
2. Create a project in the [Firebase console](http://firebase.google.com/console) and install the [Firebase CLI](https://firebase.google.com/docs/cli/)
3. Run `firebase login` via the CLI and then `firebase init functions` to initialize the Firebase SDK for Cloud Functions. When prompted, don't overwrite `functions/package.json` or `functions/index.js`.
4. In your Cloud console for the same project, enable the Vision API
5. Generate a service account for your project by navigating to the "Project settings" tab in your Firebase console and then selecting "Service Accouts". Click "Generate New Private Key" and save the file to your `functions/` directory in a file called `keyfile.json`:

![Project settings](project-settings.png)

![Service accounts](service-accounts.png)

6. In `functions/index.js` replace both instances of `your-firebase-project-id` with the ID of your Firebase project
7. Deploy your Cloud Function by running `firebase deploy --only functions`
8. From the Authentication tab in your Firebase console, enable *Twitter authentication* (you can use whichever auth provider you'd like, I chose Twitter).
9. Run the frontend locally by running `firebase serve` from the `vision-api-firebase/` directory of this project. Navigate to `localhost:5000` to try uploading a photo. After uploading a photo check your Functions logs and then your Firebase Database to confirm the function executed correctly.
10. Deploy the frontend by running `firebase deploy --only hosting`. For future deploys you can run `firebase deploy` to deploy Functions and Hosting simultaneously.

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
7. Install node modules: `npm install`
8. Run the script: `node twitter.js`

## Multiple API demo

1. `cd` into `vision-speech-nl-translate`
2. Make sure you've set up your [GOOGLE_APPLICATION_CREDENTIALS](https://developers.google.com/identity/protocols/application-default-credentials) with a Cloud project that has the Vision, Speech, NL, and Translation APIs enabled
3. Run the script: `python textify.py`
4. Note: if you're running it with image OCR, copy an image file to your local directory
