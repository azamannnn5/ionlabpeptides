
document.addEventListener("DOMContentLoaded", function() {
  const checkbox = document.getElementById("acknowledge");
  const continueBtn = document.getElementById("continue-btn");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const errorMsg = document.getElementById("error-msg");

  continueBtn.addEventListener("click", function(e) {
    e.preventDefault();
    if (!checkbox.checked) {
      errorMsg.style.display = "block";
    } else {
      errorMsg.style.display = "none";
      step1.style.display = "none";
      step2.style.display = "block";
    }
  });
});

