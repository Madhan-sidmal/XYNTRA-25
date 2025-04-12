import cv2
import mediapipe as mp
import numpy as np
from tensorflow.keras.models import load_model
import pickle

model = load_model('sign_model.h5')
with open('label_encoder.pkl', 'rb') as f:
    le = pickle.load(f)

mp_hands = mp.solutions.hands
hands = mp_hands.Hands()
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(image)
    frame = cv2.flip(frame, 1)

    prediction = ''

    if results.multi_hand_landmarks:
        for hand in results.multi_hand_landmarks:
            landmarks = []
            for lm in hand.landmark:
                landmarks.extend([lm.x, lm.y, lm.z])

            if len(landmarks) == 63:
                prediction = model.predict(np.array([landmarks]))[0]
                predicted_label = le.inverse_transform([np.argmax(prediction)])[0]
                prediction = predicted_label

    cv2.putText(frame, f'Prediction: {prediction}', (10, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 0, 0), 2)
    cv2.imshow("Prediction", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()