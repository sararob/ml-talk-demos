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




// TODO: initialize Firebase. Place your Firebase config credentials here
// var config = {....}
// firebase.initializeApp(config);

const database = firebase.database();
const adjRef = database.ref('tokens').child('ADJ');
const htRef = database.ref('hashtags');


database.ref('latest').on('value', function(data) {

  let tweet = data.val();
  let currentScore = tweet.score;

  let hashtagArr = [];
  let entityArr = [];
  let nounArr = [];
  let adjArr = [];
  let verbArr = [];

  for (let i in tweet.hashtags) {
    let htText = tweet.hashtags[i].text;
    hashtagArr.push(htText);
  }

  for (let i in tweet.entities) {
    let entityText = tweet.entities[i].name;
    entityArr.push(entityText);
  }

  for (let i in tweet.tokens) {
    let token = tweet.tokens[i];
    if ((token.partOfSpeech.tag === "NOUN") && (token.lemma != "#") && (token.lemma.substring(0,4) != "http")) {
      nounArr.push(token.lemma.toLowerCase());
    } else if (token.partOfSpeech.tag === "ADJ") {
      adjArr.push(token.lemma.toLowerCase());
    } if (token.partOfSpeech.tag === "VERB") {
      verbArr.push(token.lemma.toLowerCase());
    }
  }


  $('#latest-tweet').fadeOut();
  $('#latest-tweet').html('');
  $('#latest-tweet').fadeIn();
  $('.nouns').text(nounArr.join(', '));
  $('.verbs').text(verbArr.join(', '));
  $('.adjectives').text(adjArr.join(', '));


  // Adjust the sentiment scale for the latest tweet
  let scaleWidthPx = 400; // width of our scale in pixels
  let scaledSentiment = (scaleWidthPx * (currentScore + 1)) / 2;
  $('#current-sentiment-latest-val').css('margin-left', scaledSentiment + 'px');

});

Chart.defaults.global.defaultFontColor = '#03A9F4';
Chart.defaults.global.defaultFontStyle = 'bold';
Chart.defaults.global.defaultFontSize = 14;
Chart.defaults.global.elements.rectangle.borderColor = '#2196F3';
Chart.defaults.global.elements.rectangle.backgroundColor = '#90CAF9';
Chart.defaults.global.legend.display = false;


adjRef.orderByValue().limitToLast(10).once('value', function(data) {

  let chartLabels = [];
  let chartData = [];

  data.forEach(function(token) {
    let word = token.key;
    chartLabels.push(word);
    chartData.push(token.val());
  });

  var ctx = document.getElementById("adjChart");

  var myChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: chartLabels.reverse(),
          datasets: [{
              label: '# of mentions',
              data: chartData.reverse(),
              borderWidth: 1
          }]
      },
      options: {
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero:true,
                      minRotation: 1,
                      autoSkip: true
                  }
              }]
          },
          title: {
            display: true,
            text: 'Most common adjectives'
          },
          showTooltips: true
      }
  });


  adjRef.orderByValue().limitToLast(10).on('value', function(newData) {

    let updatedLabels = [];
    let updatedData = [];

    newData.forEach(function(token) {
      let word = token.key;
      updatedLabels.push(word);
      updatedData.push(token.val());
    });

    myChart.data.datasets[0].data = updatedData.reverse();
    myChart.data.labels = updatedLabels.reverse();
    myChart.update();

  });
});

htRef.orderByChild('numMentions').limitToLast(10).on('value', function(data) {

  let htChartLabels = [];
  let labelSentiments = [];

  data.forEach(function(snap) {
    let ht = snap.key;
    htChartLabels.push(ht);
    let numMentions = snap.val().numMentions;
    let sentiment = snap.val().totalScore / numMentions;
    labelSentiments.push(sentiment);
  });

  var scaleChart = document.getElementById("htChart");

  var htChart = new Chart(scaleChart, {
    type: 'horizontalBar',
    data: {
      labels: htChartLabels,
      datasets: [{
        label: 'sentiment value',
        data: labelSentiments,
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
        text: 'Sentiment by hashtag'
      },
      scales: {
        xAxes: [{
          ticks: {
            min: -1,
            max: 1
          }
        }]
      },
      responsive: true
    }
  });
});