import speech_recognition as sr
import requests
import json
import time

def listen_and_send():
    r = sr.Recognizer()
    
    print("🎤 Adjusting for ambient noise... Please wait.")
    with sr.Microphone() as source:
        r.adjust_for_ambient_noise(source, duration=1)
        print("\n🟢 Listening! Speak now (say something about a meeting, a person, or a project)...")
        print("   (Pause speaking to finish recording)")
        
        try:
            audio = r.listen(source, timeout=10, phrase_time_limit=15)
            print("\n⏳ Processing speech...")
            
            # Using Google's free web speech API for quick testing
            text = r.recognize_google(audio)
            print(f"\n📝 You said: '{text}'")
            
            print("\n🚀 Sending to NEURIS Backend pipeline...")
            start = time.time()
            
            response = requests.post(
                "http://localhost:8000/api/v1/conversations/ingest",
                json={"text": text}
            )
            
            latency = time.time() - start
            print(f"✅ Backend responded in {latency:.2f} seconds!")
            
            # Print beautiful JSON response
            print("\n🧠 NEURIS Response:")
            print(json.dumps(response.json(), indent=2))
            
        except sr.WaitTimeoutError:
            print("❌ No speech detected.")
        except sr.UnknownValueError:
            print("❌ Could not understand the audio.")
        except sr.RequestError as e:
            print(f"❌ Error with speech recognition service: {e}")
        except Exception as e:
            print(f"❌ Failed to reach backend: {e}")

if __name__ == "__main__":
    listen_and_send()
