// Copyright 2017 Google Inc.

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

const functions = require('firebase-functions');
const config = require('./local.json');

const fbConfig = {
  projectId: "your-firebase-project-id",
  keyfileName: 'keyfile.json'
};

const vision = require('@google-cloud/vision')(fbConfig);

const admin = require("firebase-admin");
const serviceAccount = require("./keyfile.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-firebase-project-id.firebaseio.com"
});

const db = admin.database();
const imageRef = db.ref('images');
const entitiesRef = db.ref('entities');
const labelsRef = db.ref('labels');
const faceRef = db.ref('faces');
const emojiRef = db.ref('emojis');
const latestImgDataRef = db.ref('latestImgData');
const emotions = ['anger','joy','sorrow','surprise'];
let userRef;

// Use a Firebase transaction to increment a counter
function incrementCount(ref, child, valToIncrement) {
  ref.child(child).transaction(function(data) {
    if (data != null) {
      data += valToIncrement;
    } else {
      data = 1;
    }
    return data;
  });
}

function detectFacesAndLabels(faces, entities) {
    if (faces) {
      for (let i in faces) {
        let face = faces[i];
        for (let j in emotions) {
          let emotion = emotions[j];
          if ((face[emotion + 'Likelihood'] === "VERY_LIKELY") || (face[emotion + 'Likelihood'] === "LIKELY") || (face[emotion + 'Likelihood'] === "POSSIBLE")) {
            incrementCount(faceRef, emotion, 1);
          }
        }
      }
    }

    if (entities) {
      for (let i in entities) {
        let entity = entities[i].description.toLowerCase();
        entity.replace(/\.|#|\$|\[|\]|\//g,''); // Remove ".", "#", "$", "[", or "]" (illegal Firebase path name)
        incrementCount(entitiesRef, entity, 1);
      }
    }
}

exports.callVision = functions.storage.object().onChange(event => {
  const obj = event.data;

  const gcsUrl = "gs://" + obj.bucket + "/" + obj.name;
  const userId = obj.name.substring(0, obj.name.indexOf('/'));
  userRef = db.ref('users').child(userId);

  return Promise.resolve()
    .then(() => {
      if (obj.resourceState === 'not_exists') {
        // This was a deletion event, we don't want to process this
        return;
      }
      if (!obj.bucket) {
        throw new Error('Bucket not provided. Make sure you have a "bucket" property in your request');
      }
      if (!obj.name) {
        throw new Error('Filename not provided. Make sure you have a "name" property in your request');
      }

      let visionReq = {
        "image": {
          "source": {
            "imageUri": gcsUrl
          }
        },
        "features": [
          {
            "type": "FACE_DETECTION"
          },
          {
            "type": "LABEL_DETECTION"
          },
          {
            "type": "LANDMARK_DETECTION"
          },
          {
            "type": "WEB_DETECTION"
          },
          {
            "type": "IMAGE_PROPERTIES"
          },
          {
            "type": "SAFE_SEARCH_DETECTION"
          }
        ]
      };

      return vision.annotate(visionReq);
    })
    .then(([visionData]) => {
      let imgMetadata = visionData[0];
      console.log('got vision data: ',imgMetadata);
      imageRef.push(imgMetadata);
      userRef.child('visionData').set(imgMetadata);
      latestImgDataRef.set(imgMetadata);
      return detectFacesAndLabels(imgMetadata.faceAnnotations, imgMetadata.webDetection.webEntities);
    })
    .then(() => {
      console.log(`Parsed vision annotation and wrote to Firebase`);
    });
});