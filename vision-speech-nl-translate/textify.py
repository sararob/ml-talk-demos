# Copyright 2017 Google Inc.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from __future__ import print_function
import base64
import json
import io
import os
import readline
import time
import ffmpy
import httplib2
from googleapiclient import discovery
from oauth2client.client import GoogleCredentials
from google.cloud import translate
from pick import pick
from termcolor import colored
import sounddevice as sd
import scipy.io.wavfile as scipy
from pygments import highlight, lexers, formatters
# Audio recording duration and sample rate
DURATION = 5
SAMPLE_RATE = 16000
# Languages supported by Neural Machine Translation
SUPPORTED_LANGUAGES = {"German": "de", "Spanish": "es", "French": "fr",
                       "Japanese": "ja", "Korean": "ko", "Portuguese": "pt",
                       "Turkish": "tr", "Chinese(Simplified)": "zh-CN"}
# [START authenticating]
DISCOVERY_URL = ('https://{api}.googleapis.com/$discovery/rest?'
                 'version={apiVersion}')
# Application default credentials provided by env variable
# GOOGLE_APPLICATION_CREDENTIALS


def get_service(api, version):
    credentials = GoogleCredentials.get_application_default().create_scoped(
        ['https://www.googleapis.com/auth/cloud-platform'])
    http = httplib2.Http()
    credentials.authorize(http)
    return discovery.build(
        api, version, http=http, discoveryServiceUrl=DISCOVERY_URL)
# [END authenticating]


def call_nl_api(text):
    service = get_service('language', 'v1')
    service_request = service.documents().annotateText(
        body={
            'document': {
                'type': 'PLAIN_TEXT',
                'content': text,
            },
            'features': {
                "extractSyntax": True,
                "extractEntities": True,
                "extractDocumentSentiment": True,
            }
        }
    )
    response = service_request.execute()
    print(colored("\nHere's the JSON repsonse" +
                  "for one token of your text:\n",
                  "cyan"))
    formatted_json = json.dumps(response['tokens'][0], indent=2)
    colorful_json = highlight(formatted_json,
                              lexers.JsonLexer(),
                              formatters.TerminalFormatter())
    print(colorful_json)
    score = response['documentSentiment']['score']
    output_text = colored(analyze_sentiment(score), "cyan")
    if response['entities']:
        entities = str(analyze_entities(response['entities']))
        output_text += colored("\nEntities found: " + entities, "white")
    return [output_text, response['language']]


def translate_text_with_model(text, model=translate.NMT):
    # Translates text into the target language.
    title = "Which language would you like to translate it to?"
    options = ["German", "Spanish", "French", "Japanese",
               "Korean", "Portuguese", "Turkish", "Chinese(Simplified)"]
    lang, index = pick(options, title)
    lang_code = SUPPORTED_LANGUAGES[lang]
    translate_client = translate.Client()
    result = translate_client.translate(
        text,
        target_language=lang_code,
        model=model)
    translate_back = translate_client.translate(
        result['translatedText'],
        target_language="en",
        model=model)
    print(colored(("Translated in " + lang +
                   ": " + result['translatedText']), "white"))
    print(colored("Your text translated back to English: " +
                  translate_back['translatedText'], "white"))


def call_speech():
    speech_prompt = input(colored("Press enter to start recording " +
                                  str(DURATION) + " seconds of audio", "cyan"))
    if speech_prompt == "":
        # Record audio and write to file using sounddevice
        myrecording = sd.rec(DURATION * SAMPLE_RATE,
                             samplerate=SAMPLE_RATE,
                             channels=1,
                             blocking=True)
        print(colored("Writing your audio to a file...", "magenta"))
        scipy.write('test.wav', SAMPLE_RATE, myrecording)
        filename = 'speech-' + str(int(time.time())) + '.flac'
        rec = ffmpy.FFmpeg(
            inputs={'test.wav': None},
            outputs={filename: None}
        )
        rec.run()
        # Encode audio file and call the Speech API
        with io.open(filename, "rb") as speech:
            # Base64 encode the binary audio file for inclusion in the JSON
            # request.
            speech_content = base64.b64encode(speech.read())
        service = get_service('speech', 'v1beta1')
        print(colored("Transcribing your audio with the Speech API...",
                      "magenta"))
        service_request = service.speech().syncrecognize(
            body={
                'config': {
                    'encoding': 'FLAC',  # raw 16-bit signed LE samples
                    'sampleRate': SAMPLE_RATE,  # 16 khz
                    'languageCode': 'en-US',  # a BCP-47 language tag
                },
                'audio': {
                    'content': speech_content.decode('UTF-8')
                    }
                })
        response = service_request.execute()
        text_response = response['results'][0]['alternatives'][0]['transcript']
        return text_response


def call_vision(filename):
    service = get_service('vision', 'v1')
    with open(filename, 'rb') as image:
        image_content = base64.b64encode(image.read())
        service_request = service.images().annotate(body={
            'requests': [{
                'image': {
                    'content': image_content.decode('UTF-8')
                },
                'features': [{
                    'type': 'DOCUMENT_TEXT_DETECTION'
                }]
            }]
        })
        response = service_request.execute()
        ocr_text = response['responses'][0]['textAnnotations'][0]['description']
        return ocr_text


def analyze_sentiment(score):
    sentiment_str = "You seem "
    if -1 <= score < -0.5:
        sentiment_str += "angry. Hope you feel better soon!"
    elif -0.5 <= score < 0.5:
        sentiment_str += "pretty neutral."
    else:
        sentiment_str += "very happy! Yay :)"
    return sentiment_str + "\n"


def analyze_entities(entities):
    arr = []
    for entity in entities:
        if 'wikipedia_url' in entity['metadata']:
            arr.append(entity['name'] + ': ' +
                       entity['metadata']['wikipedia_url'])
        else:
            arr.append(entity['name'])
    return arr


def handle_nl_and_translate_call(text):
    nl_response = call_nl_api(text)
    analyzed_text = nl_response[0]
    print(analyzed_text)
    translate_ready = input(colored("Next, we'll translate your text using" +
                                    " Neural Machine Translation.\n" +
                                    "Press enter when you're ready\n", "cyan"))
    if translate_ready == "":
        translate_text_with_model(text)


print(colored("We're going to send some text to the Natural Language API!\n" +
              "It supports English, Spanish, and Japanese.\n", "cyan"))
STEP_ONE = input(colored("Enter 't' to type your text,\n" +
                         "'r' to record your text,\n" +
                         "or 'p' to send a photo with text: ", "cyan"))
print("\r")
if STEP_ONE == 't':
    NL_TEXT = input(colored("Enter your text to send\n", "cyan"))
    handle_nl_and_translate_call(NL_TEXT)
elif STEP_ONE == 'r':
    TRANSCRIBED_TEXT = call_speech()
    print("You said: " + TRANSCRIBED_TEXT)
    handle_nl_and_translate_call(TRANSCRIBED_TEXT)
elif STEP_ONE == 'p':
    # Get image url
    URL = input(colored("Enter the filepath of your image: ", "cyan"))
    if os.path.exists(URL):
        print(colored("Valid image URL, sending your image" +
                      " to the Vision API...", "cyan"))
        IMG_TEXT = call_vision(URL)
        print(colored("Found this text in your image: \n" + IMG_TEXT, "white"))
        handle_nl_and_translate_call(IMG_TEXT)
else:
    STEP_ONE = input("That's not a valid entry.")
