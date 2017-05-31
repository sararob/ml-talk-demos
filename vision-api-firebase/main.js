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

const storage = firebase.storage();
const storageRef = storage.ref();
const db = firebase.database();

const facesRef = db.ref('faces');
const labelsRef = db.ref('labels');
const entitiesRef = db.ref('entities');
const latestImageRef = db.ref('latest');
const numPhotosRef = db.ref('images');
const devicesRef = db.ref('devices');
const latestImgDataRef = db.ref('latestImgData');
const emotions = ['joy', 'anger', 'sorrow', 'surprise'];
const provider = new firebase.auth.TwitterAuthProvider();

let isiPhone = false;
let userId;
let userRef;

// Set default chart settings
Chart.defaults.global.defaultFontColor = '#3F51B5';
Chart.defaults.global.defaultFontStyle = 'bold';
Chart.defaults.global.elements.rectangle.borderColor = '#3F51B5';
Chart.defaults.global.elements.rectangle.backgroundColor = '#9FA8DA';
Chart.defaults.global.legend.display = false;

numPhotosRef.on('value', function(snap) {
    let numPhotos = snap.numChildren();
    $('#num-selfies').html('<strong>' + numPhotos + '</strong>');
});

function writeImgtoFb(dataURL, imageRef) {
  imageRef.putString(dataURL, 'data_url').then(function(snapshot) {
    $('#user-img-data').html("");
    $('.data-load-spinner').addClass('is-active');
    let gcsUrl = "gs://" + imageRef.location.bucket + "/" + imageRef.location.path;
    userRef.child('gcsUrl').set(gcsUrl);
    latestImageRef.set({gcsUrl: gcsUrl});
  }).catch(function(error) {
    if (error.code === "storage/unauthorized") {
        $(".mdl-spinner").remove();
        $('.permission-denied').css('visibility', 'visible');
    }
  });


}




// iPhones do a weird image rotation thing - this checks for iPhone using WURFL
function checkIfiPhone(deviceType) {
    if (deviceType.toLowerCase().includes('iphone')) {
        isiPhone = true;
    }
}

devicesRef.push(WURFL);
checkIfiPhone(WURFL.complete_device_name);

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {

    userId = user.uid;
    userRef = db.ref('users').child(userId);

    latestImgDataRef.on('value', function (snap) {

        let latestImgData = snap.val();
        let facesStr = "";
        let labelsStr = "Labels found: ";

        if (latestImgData !== null) {

            if (latestImgData.faceAnnotations) {
                facesStr += "Found a face!";
                let face = latestImgData.faceAnnotations[0];

                for (let j in emotions) {
                    let emotion = emotions[j];
                    if ((face[emotion + 'Likelihood'] === "VERY_LIKELY") || (face[emotion + 'Likelihood'] === "LIKELY") || (face[emotion + 'Likelihood'] === "POSSIBLE")) {
                        facesStr += " Detected <strong>" + emotion + "</strong>.";
                    }
                }
            }

            if (latestImgData.webDetection.webEntities) {
                let labels = latestImgData.webDetection.webEntities;
                let labelsFound = [];
                for (let i in labels) {
                    let label = labels[i].description.toLowerCase();
                    if (label.length > 1) {
                        labelsFound.push("<strong>" + label + "</strong>");
                    }
                }
                labelsStr += labelsFound.join(", ");
            }

            $('#user-img-data').html(labelsStr + "<br/>" + facesStr);
            $('.data-load-spinner').removeClass('is-active');
            $('.img-load-spinner').removeClass('is-active');
        }
    });

  } else {
    firebase.auth().signInWithRedirect(provider).then(function(result) {
      // This gives you a the Twitter OAuth 1.0 Access Token and Secret.
      // You can use these server side with your app's credentials to access the Twitter API.
      let token = result.credential.accessToken;
      let secret = result.credential.secret;
      // The signed-in user info.
      let user = result.user;

    }).catch(function(error) {

      let errorCode = error.code;
      let errorMessage = error.message;
      let credential = error.credential;
    });
  }
});


function valueToEmoji(emotion) {
    if (emotion === "joy") {
        return ":‑)";
    } else if (emotion === "sorrow") {
        return ":‑(";
    } else if (emotion === "anger"){
        return ">:(";
    } else if (emotion === "surprise") {
        return " :‑o";
    } else {
        return ":-/";
    }
}



facesRef.on('value', function(snap) {
    let faceLabels = [];
    let faceCount = [];

    snap.forEach(function(faceData) {
        let emotion = faceData.key;
        let emoji = valueToEmoji(emotion);
        faceLabels.push(emoji);
        faceCount.push(faceData.val());
    });

    let faceChart = document.getElementById("faceChart");

    let htChart = new Chart(faceChart, {
        type: 'horizontalBar',
        data: {
            labels: faceLabels,
            datasets: [{
                label: 'number of faces',
                data: faceCount,
                borderWidth: 1,
            }]
        },
        options: {
            elements: {
                rectangle: {
                    borderWidth: 2
                }
            },
            title: {
                display: true,
                text: 'Total emotions detected'
            },
            scales: {
                yAxes: [{
                    ticks: {
                        fontSize: 30,
                        beginAtZero: true
                    }
                }],
                xAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            responsive: true
        }
    });

});



entitiesRef.orderByValue().limitToLast(10).on('value', function(snap) {
    let labels = [];
    let counts = [];

    snap.forEach(function(labelData) {
        let label = labelData.key;
        labels.push(label);
        counts.push(labelData.val());
    });

    let labelsChart = document.getElementById("labelsChart");

    let htChart = new Chart(labelsChart, {
        type: 'horizontalBar',
        data: {
            labels: labels.reverse(),
            datasets: [{
                label: '# of pictures',
                data: counts.reverse(),
                borderWidth: 1
            }]
        },
        options: {
            elements: {
                rectangle: {
                    borderWidth: 2
                }
            },
            title: {
                display: true,
                text: 'Total entities detected'
            },
            scales: {
                yAxes: [{
                    fontSize: 20
                }],
                xAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            responsive: true
        }
    });

});


function rotateBase64Image90Degree(base64data, imageRef) {
  let canvas = document.getElementById("c");
  let ctx = canvas.getContext("2d");
  let image = new Image();

  image.src = base64data;
  image.onload = function() {
    canvas.width = image.height;
    canvas.height = image.width;
    ctx.rotate(90 * Math.PI / 180);
    ctx.translate(0, -canvas.width);
    ctx.drawImage(image, 0, 0);

    let b64 = canvas.toDataURL();
    writeImgtoFb(b64, imageRef);
  };
}


// Save image to Firebase Storage
$(function() {
   $("#img-select").change(function (){

      if (userId) {
         $('.img-load-spinner').addClass('is-active');
         $("#img-status").html("Uploading to Firebase...");


          let elm = document.getElementById('img-select'),
              img = elm.files[0],
              fileName = img.name,
              fileSize = img.size;

          let reader = new FileReader();

          reader.onload = function(e) {
            let dataURL = reader.result;

            let imageRef = storageRef.child(userId + '/' + fileName);
            if (isiPhone) {
              rotateBase64Image90Degree(dataURL, imageRef);
            } else {
              writeImgtoFb(dataURL, imageRef);
            }
          };
          reader.readAsDataURL(img);
      }
   });
});

latestImageRef.on('value', function(data) {
    let gsRef = storage.refFromURL(data.val().gcsUrl);
    gsRef.getDownloadURL().then(function(url) {
      $('.img-load-spinner').removeClass('is-active');
      let img = document.getElementById('latest-selfie');
      img.src = url;


    }).catch(function(error) {
      // Handle any errors
    });

});