// utils/sharedState.js
let idleTime = 0;

function setIdleTime(value) {
  idleTime = value;
}

function getIdleTime() {
  return idleTime;
}

module.exports = { setIdleTime, getIdleTime };
