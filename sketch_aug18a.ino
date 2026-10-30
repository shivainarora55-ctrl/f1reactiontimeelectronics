// --- BREADBOARD 1 (PLAYER 1) PINS ---
const int BB1_RED1  = 2;
const int BB1_RED2  = 3;
const int BB1_RED3  = 4;
const int BB1_GREEN = 5;
const int BB1_BLUE  = 6;

// --- BREADBOARD 2 (PLAYER 2) PINS ---
const int BB2_RED1  = 7;
const int BB2_RED2  = 8;
const int BB2_RED3  = 9;
const int BB2_GREEN = 10;
const int BB2_BLUE  = 11;

// --- BUTTON PINS (Moved off D13 to avoid built-in LED conflict) ---
const int BTN_P1 = A1;
const int BTN_P2 = A2;

// Common Anode Logic (Active LOW)
const int LED_ON  = LOW;
const int LED_OFF = HIGH;

enum State {
  STATE_IDLE_BLUE,
  STATE_STARTING_REDS,
  STATE_WAIT_FOR_GREEN,
  STATE_WAIT_FOR_PRESS,
  STATE_ROUND_FINISHED
};

State currentState = STATE_IDLE_BLUE;

unsigned long stateTimer = 0;
unsigned long greenStartTime = 0;
unsigned long randomGreenDelay = 0;

int p1Reaction = -1;
int p2Reaction = -1;

void setBoard1Leds(bool r1, bool r2, bool r3, bool g, bool b) {
  digitalWrite(BB1_RED1,  r1 ? LED_ON : LED_OFF);
  digitalWrite(BB1_RED2,  r2 ? LED_ON : LED_OFF);
  digitalWrite(BB1_RED3,  r3 ? LED_ON : LED_OFF);
  digitalWrite(BB1_GREEN, g  ? LED_ON : LED_OFF);
  digitalWrite(BB1_BLUE,  b  ? LED_ON : LED_OFF);
}

void setBoard2Leds(bool r1, bool r2, bool r3, bool g, bool b) {
  digitalWrite(BB2_RED1,  r1 ? LED_ON : LED_OFF);
  digitalWrite(BB2_RED2,  r2 ? LED_ON : LED_OFF);
  digitalWrite(BB2_RED3,  r3 ? LED_ON : LED_OFF);
  digitalWrite(BB2_GREEN, g  ? LED_ON : LED_OFF);
  digitalWrite(BB2_BLUE,  b  ? LED_ON : LED_OFF);
}

void setBothBoards(bool r1, bool r2, bool r3, bool g, bool b) {
  setBoard1Leds(r1, r2, r3, g, b);
  setBoard2Leds(r1, r2, r3, g, b);
}

void resetToBlueIdle() {
  currentState = STATE_IDLE_BLUE;
  p1Reaction = -1;
  p2Reaction = -1;
  setBothBoards(false, false, false, false, true); // Solid Blue
  Serial.println("STATUS:IDLE");
}

void triggerStartSequence() {
  p1Reaction = -1;
  p2Reaction = -1;
  setBothBoards(false, false, false, false, false); // All OFF
  stateTimer = millis();
  currentState = STATE_STARTING_REDS;
  Serial.println("STATUS:STARTING");
}

void setup() {
  Serial.begin(9600);
  randomSeed(analogRead(A0));

  // BB1 Output configuration
  pinMode(BB1_RED1, OUTPUT);
  pinMode(BB1_RED2, OUTPUT);
  pinMode(BB1_RED3, OUTPUT);
  pinMode(BB1_GREEN, OUTPUT);
  pinMode(BB1_BLUE, OUTPUT);

  // BB2 Output configuration
  pinMode(BB2_RED1, OUTPUT);
  pinMode(BB2_RED2, OUTPUT);
  pinMode(BB2_RED3, OUTPUT);
  pinMode(BB2_GREEN, OUTPUT);
  pinMode(BB2_BLUE, OUTPUT);

  // Buttons with internal pull-up
  pinMode(BTN_P1, INPUT_PULLUP);
  pinMode(BTN_P2, INPUT_PULLUP);

  resetToBlueIdle();
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'S' || cmd == 's') {
      triggerStartSequence();
    } else if (cmd == 'R' || cmd == 'r') {
      resetToBlueIdle();
    }
  }

  switch (currentState) {

    case STATE_IDLE_BLUE:
      break;

    case STATE_STARTING_REDS: {
      unsigned long elapsed = millis() - stateTimer;
      if (elapsed < 1000) {
        setBothBoards(true, false, false, false, false);
        Serial.println("LIGHTS:RED1");
      } else if (elapsed < 2000) {
        setBothBoards(true, true, false, false, false);
        Serial.println("LIGHTS:RED2");
      } else if (elapsed < 3000) {
        setBothBoards(true, true, true, false, false);
        Serial.println("LIGHTS:RED3");
      } else {
        randomGreenDelay = random(1500, 3500);
        stateTimer = millis();
        currentState = STATE_WAIT_FOR_GREEN;
      }
      break;
    }

    case STATE_WAIT_FOR_GREEN:
      if (digitalRead(BTN_P1) == LOW && p1Reaction == -1) {
        p1Reaction = -999;
        Serial.println("EVENT:P1_JUMP");
      }
      if (digitalRead(BTN_P2) == LOW && p2Reaction == -1) {
        p2Reaction = -999;
        Serial.println("EVENT:P2_JUMP");
      }

      if (millis() - stateTimer >= randomGreenDelay) {
        setBothBoards(false, false, false, true, false);
        greenStartTime = micros();
        currentState = STATE_WAIT_FOR_PRESS;
        Serial.println("LIGHTS:GREEN");
      }
      break;

    case STATE_WAIT_FOR_PRESS: {
      unsigned long nowUs = micros();

      if (digitalRead(BTN_P1) == LOW && p1Reaction == -1) {
        p1Reaction = (nowUs - greenStartTime) / 1000;
        Serial.print("RESULT:P1:");
        Serial.println(p1Reaction);
      }

      if (digitalRead(BTN_P2) == LOW && p2Reaction == -1) {
        p2Reaction = (nowUs - greenStartTime) / 1000;
        Serial.print("RESULT:P2:");
        Serial.println(p2Reaction);
      }

      if ((p1Reaction != -1 && p2Reaction != -1) || (millis() - (greenStartTime / 1000) > 5000)) {
        currentState = STATE_ROUND_FINISHED;
        setBothBoards(false, false, false, false, true); // Switch to Blue
        Serial.println("LIGHTS:BLUE");
        Serial.println("STATUS:FINISHED");
      }
      break;
    }

    case STATE_ROUND_FINISHED:
      break;
  }
}