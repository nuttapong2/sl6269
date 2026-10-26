CREATE TABLE attendance (
  attendance_date TEXT NOT NULL,
  student_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','late','leave','absent')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attendance_date, student_no)
);

CREATE TABLE duty_checks (
  duty_date TEXT NOT NULL,
  student_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','not_done')),
  points INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (duty_date, student_no)
);

CREATE TABLE score_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_no INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_no INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_duty_date ON duty_checks(duty_date);
CREATE INDEX idx_score_student ON score_events(student_no);
CREATE INDEX idx_savings_student ON savings(student_no);
