let storage = firebase.storage();
let storageRef = storage.ref();
let db = firebase.database();

let facesRef = db.ref('faces');
let labelsRef = db.ref('labels');
let entitiesRef = db.ref('entities');
let latestImageRef = db.ref('latest');
let numPhotosRef = db.ref('images');
let devicesRef = db.ref('devices');
let latestImgDataRef = db.ref('latestImgData');
let userId;
let userRef;
const emotions = ['joy', 'anger', 'sorrow', 'surprise'];
let isiPhone = false;

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


var provider = new firebase.auth.TwitterAuthProvider();

// iPhones do a weird image rotation thing - this checks for iPhone and rotates the image in getOrientation()
function checkIfiPhone(deviceType) {
    if (deviceType.toLowerCase().includes('iphone')) {
        isiPhone = true;
    }
}


function getOrientation(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {

    var view = new DataView(e.target.result);
    if (view.getUint16(0, false) != 0xFFD8) return callback(-2);
    var length = view.byteLength, offset = 2;
    while (offset < length) {
      var marker = view.getUint16(offset, false);
      offset += 2;
      if (marker == 0xFFE1) {
        if (view.getUint32(offset += 2, false) != 0x45786966) return callback(-1);
        var little = view.getUint16(offset += 6, false) == 0x4949;
        offset += view.getUint32(offset + 4, little);
        var tags = view.getUint16(offset, little);
        offset += 2;
        for (var i = 0; i < tags; i++)
          if (view.getUint16(offset + (i * 12), little) == 0x0112)
            return callback(view.getUint16(offset + (i * 12) + 8, little));
      }
      else if ((marker & 0xFF00) != 0xFF00) break;
      else offset += view.getUint16(offset, false);
    }
    return callback(-1);
  };
  reader.readAsArrayBuffer(file);
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

        if (latestImgData != null) {

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
      var token = result.credential.accessToken;
      var secret = result.credential.secret;
      // The signed-in user info.
      var user = result.user;

    }).catch(function(error) {

      var errorCode = error.code;
      var errorMessage = error.message;
      var credential = error.credential;
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
        return "🤔";
    }
};



facesRef.on('value', function(snap) {
    let faceLabels = [];
    let faceCount = [];

    snap.forEach(function(faceData) {
        let emotion = faceData.key;
        let emoji = valueToEmoji(emotion);
        faceLabels.push(emoji);
        faceCount.push(faceData.val());
    });

    var faceChart = document.getElementById("faceChart");

    var htChart = new Chart(faceChart, {
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

    var labelsChart = document.getElementById("labelsChart");

    var htChart = new Chart(labelsChart, {
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
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var image = new Image();

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
         var fileName = $(this).val();
         $("#img-status").html("Uploading to Firebase...");


          var elm = document.getElementById('img-select'),
              img = elm.files[0],
              fileName = img.name,
              fileSize = img.size;

          var reader = new FileReader();

          reader.onload = function(e) {
            var dataURL = reader.result;

            let imageRef = storageRef.child(userId + '/' + fileName);
            if (isiPhone) {
              rotateBase64Image90Degree(dataURL, imageRef);
            } else {
              writeImgtoFb(dataURL, imageRef);
            }
          }
          reader.readAsDataURL(img);
      }
   });
});

latestImageRef.on('value', function(data) {
    let gsRef = storage.refFromURL(data.val().gcsUrl);
    gsRef.getDownloadURL().then(function(url) {
      $('.img-load-spinner').removeClass('is-active');
      var img = document.getElementById('latest-selfie');
      img.src = url;


    }).catch(function(error) {
      // Handle any errors
    });

});

