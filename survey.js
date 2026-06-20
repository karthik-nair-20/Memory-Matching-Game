// ============================================================================
// Reusable Survey component.
// Renders the 5 Likert questions from config.js. All questions are required:
// the Submit button stays disabled until every question is answered.
// ============================================================================

function renderSurvey(container, { title, onSubmit } = {}) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "survey";

  if (title) {
    const h = document.createElement("h2");
    h.textContent = title;
    wrap.appendChild(h);
  }

  const form = document.createElement("form");
  form.className = "survey-form";

  SURVEY_QUESTIONS.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "survey-question";

    const label = document.createElement("p");
    label.className = "survey-label";
    label.textContent = qi + 1 + ". " + q.label;
    block.appendChild(label);

    const scale = document.createElement("div");
    scale.className = "likert-scale";

    LIKERT_LABELS.forEach((labelText, idx) => {
      const value = idx + 1;
      const option = document.createElement("label");
      option.className = "likert-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = q.key;
      input.value = String(value);
      input.required = true;
      input.addEventListener("change", updateSubmitState);

      const caption = document.createElement("span");
      caption.className = "likert-caption";
      caption.innerHTML = "<strong>" + value + "</strong><br/>" + labelText;

      option.appendChild(input);
      option.appendChild(caption);
      scale.appendChild(option);
    });

    block.appendChild(scale);
    form.appendChild(block);
  });

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "survey-submit";
  submit.textContent = "Submit";
  submit.disabled = true;
  form.appendChild(submit);

  function updateSubmitState() {
    const answered = SURVEY_QUESTIONS.every((q) => form.querySelector(`input[name="${q.key}"]:checked`));
    submit.disabled = !answered;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const responses = {};
    SURVEY_QUESTIONS.forEach((q) => {
      const checked = form.querySelector(`input[name="${q.key}"]:checked`);
      responses[q.key] = checked ? parseInt(checked.value, 10) : null;
    });
    if (onSubmit) onSubmit(responses);
  });

  wrap.appendChild(form);
  container.appendChild(wrap);
}
