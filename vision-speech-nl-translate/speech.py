import sounddevice as sd
import scipy.io.wavfile as scipy
import base64,json,ffmpy,time,sys,httplib2,io,os,logging,readline
from googleapiclient import discovery
from oauth2client.client import GoogleCredentials
from google.cloud import translate
from termcolor import colored, cprint
from pick import pick

# Audio recording duration
duration = 5

# Langs supported by Premium Translation
supported_languages = {"German":"de", "Spanish":"es", "French":"fr", "Japanese":"ja", "Korean":"ko", "Portuguese":"pt", "Turkish":"tr", "Chinese(Simplified)":"zh-CN"}


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
    print(response)
    # print(response['language'])
    score = response['documentSentiment']['score']
    magnitude = response['documentSentiment']['magnitude']
    output_text = colored(analyze_sentiment(score, magnitude), "magenta")

    if response['entities']:
        entities = str(analyze_entities(response['entities']))
        output_text += colored("\nEntities found: " + entities, "green")
    return [output_text, response['language']]

def translate_text_with_model(text, model=translate.NMT):

    # Translates text into the target language.
    title = "Which language would you like to translate it to?"
    options = ["German", "Spanish", "French", "Japanese", "Korean", "Portuguese", "Turkish", "Chinese(Simplified)"]
    lang, index = pick(options, title)
    lang_code = supported_languages[lang]

    translate_client = translate.Client()

    result = translate_client.translate(
        text,
        target_language=lang_code,
        model=model)

    # print(u'Text: {}'.format(result['input']))
    # print(u'Translation: {}'.format(result['translatedText']))
    # print(u'Detected source language: {}'.format(
    #     result['detectedSourceLanguage']))
    print(colored(("Translated in " + lang + ": " + result['translatedText']), "green"))


def call_speech():
    s = input(colored("Press enter to start recording " + str(duration) + " seconds of audio", "cyan"))
    if s == "":
        # Record audio and write to file using sounddevice
        fs = 16000
        myrecording = sd.rec(duration * fs, samplerate=fs, channels=1, blocking=True)
        print(colored("Writing your audio to a file...", "magenta"))
        scipy.write('test.wav', fs, myrecording)
        filename = 'speech-' + str(int(time.time())) + '.flac'
        ff = ffmpy.FFmpeg(
            inputs={'test.wav':None},
            outputs={filename:None}
        )
        ff.run()

        # Encode audio file and call the Speech API
        with io.open(filename,"rb") as speech:
            # Base64 encode the binary audio file for inclusion in the JSON
            # request.
            speech_content = base64.b64encode(speech.read())

        service = get_service('speech', 'v1beta1')
        print(colored("Transcribing your audio with the Speech API...", "magenta"))
        service_request = service.speech().syncrecognize(
            body={
                'config': {
                    'encoding': 'FLAC',  # raw 16-bit signed LE samples
                    'sampleRate': 16000,  # 16 khz
                    'languageCode': 'en-US',  # a BCP-47 language tag
                },
                'audio': {
                    'content': speech_content.decode('UTF-8')
                    }
                })

        response = service_request.execute()
        transcribed_text = response['results'][0]['alternatives'][0]['transcript']
        # output_text = colored('Sending "' + transcribed_text + '" to the Natural Language API...', 'magenta')
        # print(output_text)
        return transcribed_text


def call_vision(file):
    service = get_service('vision','v1')
    with open(file,'rb') as image:
        image_content = base64.b64encode(image.read())
        service_request = service.images().annotate(body={
            'requests': [{
                'image': {
                    'content': image_content.decode('UTF-8')
                },
                'features': [{
                    'type': 'TEXT_DETECTION'
                }]
            }]
        })
        response = service_request.execute()
        ocr_text = response['responses'][0]['textAnnotations'][0]['description']
        return ocr_text

def analyze_sentiment(score, magnitude):
    # print(score, magnitude)
    sentiment_str = "You seem "
    if -1 <= score < -0.5:
        sentiment_str += "angry. Hope you feel better soon!"
    elif -0.5 <= score < 0.5:
        sentiment_str += "pretty neutral."
    else:
        sentiment_str += "very happy! Yay :)"
    return sentiment_str

def analyze_entities(entities):
    arr = []
    for entity in entities:
        if 'wikipedia_url' in entity['metadata']:
            arr.append(entity['name'] + ': ' + entity['metadata']['wikipedia_url'])
        else:
            arr.append(entity['name'])
    return arr

def handle_nl_and_translate_call(text):
    nl_response = call_nl_api(text)
    analyzed_text = nl_response[0]
    text_lang = nl_response[1]
    print(analyzed_text)
    translate_ready = input(colored("Next, we'll translate your text using Premium Translation.\nPress enter when you're ready", "magenta"))
    if translate_ready == "":
        translate_text_with_model(text)

print(colored("We're going to send some text to the Natural Language API!\nIt supports English, Spanish, and Japanese.", "magenta"))
step_one = input(colored("Enter 't' to type your text,\n'r' to record your text,\nor 'p' to send a photo with text: ", "cyan"))
if step_one == 't':
    nl_text = input(colored("Enter your text to send\n", "cyan"))
    handle_nl_and_translate_call(nl_text)
elif step_one == 'r':
    transcribed_text = call_speech()
    print("You said: " + transcribed_text)
    handle_nl_and_translate_call(transcribed_text)
elif step_one == 'p':
    # Get image url
    url = input(colored("Enter the filepath of your image: ", "cyan"))
    if os.path.exists(url): # TODO: regex to validate file type
        print(colored("Valid image URL, sending your image to the Vision API...", "magenta"))
        img_text = call_vision(url)
        print(colored("Found this text in your image: " + img_text, "green"))
        handle_nl_and_translate_call(img_text)
else:
    step_one = input("That's not a valid entry.")

