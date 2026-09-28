(function () {
  "use strict";

  const courseCountInput = document.getElementById("courseCount");
  const courseGrid = document.getElementById("courseGrid");
  const examGrid = document.getElementById("examGrid");

  const courseSumEl = document.getElementById("courseSum");
  const courseAvgEl = document.getElementById("courseAvg");
  const block1ScoreEl = document.getElementById("block1Score");

  const examSumEl = document.getElementById("examSum");
  const examAvgEl = document.getElementById("examAvg");
  const block2ScoreEl = document.getElementById("block2Score");

  const totalScoreEl = document.getElementById("totalScore");
  const finalGradeEl = document.getElementById("finalGrade");
  const statusBox = document.getElementById("statusBox");
  const rulesList = document.getElementById("rulesList");
  const resetBtn = document.getElementById("resetBtn");

  const MIN_COURSES_RECOMMENDED = 32;
  const MAX_COURSES_RECOMMENDED = 40;
  const MAX_POINTS_PER_UNIT = 15;

  let courseValues = [];
  let examValues = [];
  let examCount = 4;

  function clampPoints(v) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return 0;
    return Math.min(MAX_POINTS_PER_UNIT, Math.max(0, n));
  }

  function formatDe(num, decimals) {
    return num.toFixed(decimals).replace(".", ",");
  }

  function buildCourseGrid(count) {
    courseGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = "Kurs " + (i + 1);
      label.setAttribute("for", "course-" + i);

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = String(MAX_POINTS_PER_UNIT);
      input.id = "course-" + i;
      input.value = courseValues[i] !== undefined ? courseValues[i] : "";
      input.addEventListener("input", () => {
        courseValues[i] = input.value === "" ? "" : clampPoints(input.value);
        if (input.value !== "" && String(clampPoints(input.value)) !== input.value) {
          input.value = clampPoints(input.value);
        }
        toggleWarnClass(input, courseValues[i]);
        calculate();
      });

      toggleWarnClass(input, courseValues[i]);

      wrap.appendChild(label);
      wrap.appendChild(input);
      courseGrid.appendChild(wrap);
    }
  }

  function toggleWarnClass(input, value) {
    input.classList.remove("zero", "warn");
    if (value === 0) input.classList.add("zero");
    else if (value !== "" && value < 5) input.classList.add("warn");
  }

  function buildExamGrid(count) {
    examGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Prüfungsfach " + (i + 1);
      nameInput.value = examValues[i] && examValues[i].name ? examValues[i].name : "";
      nameInput.addEventListener("input", () => {
        examValues[i] = examValues[i] || {};
        examValues[i].name = nameInput.value;
      });

      const label = document.createElement("label");
      label.textContent = "Punkte (0–15)";
      label.setAttribute("for", "exam-" + i);

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = String(MAX_POINTS_PER_UNIT);
      input.id = "exam-" + i;
      input.value = examValues[i] && examValues[i].points !== undefined ? examValues[i].points : "";
      input.addEventListener("input", () => {
        examValues[i] = examValues[i] || {};
        examValues[i].points = input.value === "" ? "" : clampPoints(input.value);
        if (input.value !== "" && String(clampPoints(input.value)) !== input.value) {
          input.value = clampPoints(input.value);
        }
        toggleWarnClass(input, examValues[i].points);
        calculate();
      });

      toggleWarnClass(input, examValues[i] && examValues[i].points);

      wrap.appendChild(nameInput);
      wrap.appendChild(label);
      wrap.appendChild(input);
      examGrid.appendChild(wrap);
    }
  }

  function gradeFromTotal(total) {
    if (total < 300) return null;
    if (total > 900) total = 900;
    const steps = Math.floor((900 - total) / 20);
    return 1.0 + steps * 0.1;
  }

  function calculate() {
    const count = courseValues.length;
    const numericCourses = courseValues.map((v) => (v === "" ? 0 : v));
    const courseSum = numericCourses.reduce((a, b) => a + b, 0);
    const courseAvg = count > 0 ? courseSum / count : 0;
    const block1Score = count > 0 ? Math.round((courseSum * 40) / count) : 0;

    courseSumEl.textContent = courseSum;
    courseAvgEl.textContent = formatDe(courseAvg, 2);
    block1ScoreEl.textContent = Math.min(block1Score, 600);

    const factor = examCount === 5 ? 4 : 5;
    const numericExams = examValues.map((e) => (e && e.points !== "" && e.points !== undefined ? e.points : 0));
    const examSum = numericExams.reduce((a, b) => a + b, 0);
    const examAvgVal = examCount > 0 ? examSum / examCount : 0;
    const block2Score = examSum * factor;

    examSumEl.textContent = examSum;
    examAvgEl.textContent = formatDe(examAvgVal, 2);
    block2ScoreEl.textContent = Math.min(block2Score, 300);

    const total = Math.min(block1Score, 600) + Math.min(block2Score, 300);
    totalScoreEl.textContent = total;

    const grade = gradeFromTotal(total);
    finalGradeEl.textContent = grade === null ? "–" : formatDe(grade, 1);

    renderStatus(total, block1Score, block2Score, numericCourses, numericExams, grade);
  }

  function renderStatus(total, block1Score, block2Score, numericCourses, numericExams, grade) {
    const checks = [];

    checks.push({
      ok: block1Score >= 200,
      text: "Block I mindestens 200 Punkte (aktuell " + Math.min(block1Score, 600) + ")"
    });
    checks.push({
      ok: block2Score >= 100,
      text: "Block II mindestens 100 Punkte (aktuell " + Math.min(block2Score, 300) + ")"
    });
    checks.push({
      ok: numericExams.every((p) => p > 0),
      text: "Keine Abiturprüfung mit 0 Punkten"
    });
    checks.push({
      ok: numericCourses.every((p) => p > 0),
      text: "Kein eingebrachter Kurs mit 0 Punkten"
    });
    const count = courseValues.length;
    checks.push({
      ok: count >= MIN_COURSES_RECOMMENDED && count <= MAX_COURSES_RECOMMENDED,
      text: "Kursanzahl im üblichen Rahmen (" + MIN_COURSES_RECOMMENDED + "–" + MAX_COURSES_RECOMMENDED + "), aktuell " + count
    });

    rulesList.innerHTML = "";
    checks.forEach((c) => {
      const li = document.createElement("li");
      li.className = c.ok ? "pass" : "fail";
      li.textContent = c.text;
      rulesList.appendChild(li);
    });

    const allOk = checks.every((c) => c.ok) && grade !== null;
    statusBox.className = "status-box " + (allOk ? "ok" : "fail");
    if (grade === null) {
      statusBox.textContent = "Gesamtpunktzahl unter 300 – die Mindestanforderung für das Bestehen ist nicht erreicht.";
    } else if (allOk) {
      statusBox.textContent = "Alle angezeigten Mindestanforderungen sind erfüllt.";
    } else {
      statusBox.textContent = "Eine oder mehrere vereinfachte Mindestanforderungen sind aktuell nicht erfüllt – siehe Details unten.";
    }
  }

  function initCourseValues(count) {
    const newValues = [];
    for (let i = 0; i < count; i++) {
      newValues.push(courseValues[i] !== undefined ? courseValues[i] : "");
    }
    courseValues = newValues;
  }

  function initExamValues(count) {
    const newValues = [];
    for (let i = 0; i < count; i++) {
      newValues.push(examValues[i] !== undefined ? examValues[i] : { name: "", points: "" });
    }
    examValues = newValues;
  }

  courseCountInput.addEventListener("input", () => {
    let count = parseInt(courseCountInput.value, 10);
    if (isNaN(count)) count = MAX_COURSES_RECOMMENDED;
    count = Math.min(44, Math.max(1, count));
    initCourseValues(count);
    buildCourseGrid(count);
    calculate();
  });

  document.querySelectorAll('input[name="examCount"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      examCount = parseInt(e.target.value, 10);
      initExamValues(examCount);
      buildExamGrid(examCount);
      calculate();
    });
  });

  resetBtn.addEventListener("click", () => {
    courseCountInput.value = MAX_COURSES_RECOMMENDED;
    document.querySelector('input[name="examCount"][value="4"]').checked = true;
    examCount = 4;
    courseValues = [];
    examValues = [];
    initCourseValues(MAX_COURSES_RECOMMENDED);
    initExamValues(4);
    buildCourseGrid(MAX_COURSES_RECOMMENDED);
    buildExamGrid(4);
    calculate();
  });

  // initial setup
  initCourseValues(parseInt(courseCountInput.value, 10));
  initExamValues(examCount);
  buildCourseGrid(courseValues.length);
  buildExamGrid(examCount);
  calculate();
})();
