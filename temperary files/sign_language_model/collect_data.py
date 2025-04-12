import cv2
import mediapipe as mp
import numpy as np
import csv
import os

mp_hands = mp.solutions.hands
hands = mp_hands.Hands()
cap = cv2.VideoCapture(0)

label = input("Enter label for this gesture (e.g. A): ")
num_samples = 200
collected = 0

os.makedirs('data', exist_ok=True)
csv_file = open(f'data/{label}.csv', mode='w', newline='')
csv_writer = csv.writer(csv_file)

print("Collecting data... Press 'q' to stop early.")

while collected < num_samples:
    ret, frame = cap.read()
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(image)
    frame = cv2.flip(frame, 1)

    if results.multi_hand_landmarks:
        for hand in results.multi_hand_landmarks:
            landmarks = []
            for lm in hand.landmark:
                landmarks.extend([lm.x, lm.y, lm.z])
            csv_writer.writerow(landmarks)
            collected += 1
            print(f'Collected: {collected}/{num_samples}')

    cv2.putText(frame, f'Label: {label}', (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("Collecting", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

csv_file.close()
cap.release()
cv2.destroyAllWindows()