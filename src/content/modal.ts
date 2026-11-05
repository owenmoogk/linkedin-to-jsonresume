const PREFIX = 'jtzLiToResumeJson';
const WRAPPER_ID = `${PREFIX}_modalWrapper`;
const STYLE_ID = `${PREFIX}_styles`;
const TEXTAREA_ID = `${PREFIX}_exportTextField`;

const STYLES = `
#${WRAPPER_ID} {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 2147483647;
}
.${PREFIX}_modal {
  width: 80%;
  margin-top: 10%;
  margin-left: 10%;
  background-color: white;
  color: black;
  padding: 20px;
  border-radius: 13px;
}
.${PREFIX}_topBar {
  width: 100%;
  position: relative;
}
.${PREFIX}_titleText {
  text-align: center;
  font-size: x-large;
  width: 100%;
  padding-top: 8px;
}
.${PREFIX}_closeButton {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0 8px;
  margin: 3px;
  border: 4px double black;
  border-radius: 10px;
  font-size: x-large;
  cursor: pointer;
}
.${PREFIX}_modalBody {
  width: 90%;
  margin-left: 5%;
  margin-top: 20px;
  padding-top: 8px;
}
#${TEXTAREA_ID} {
  width: 100%;
  min-height: 300px;
}
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function closeModal(): void {
  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) wrapper.style.display = 'none';
}

/**
 * Create the modal. Built with DOM APIs rather than `innerHTML`, since
 * LinkedIn enforces Trusted Types.
 */
function createModal(): HTMLElement {
  injectStyles();

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;

  const modal = document.createElement('div');
  modal.className = `${PREFIX}_modal`;

  const topBar = document.createElement('div');
  topBar.className = `${PREFIX}_topBar`;

  const title = document.createElement('div');
  title.className = `${PREFIX}_titleText`;
  title.textContent = 'Profile Export:';

  const closeButton = document.createElement('div');
  closeButton.className = `${PREFIX}_closeButton`;
  closeButton.textContent = 'X';
  closeButton.addEventListener('click', closeModal);

  const body = document.createElement('div');
  body.className = `${PREFIX}_modalBody`;

  const textArea = document.createElement('textarea');
  textArea.id = TEXTAREA_ID;
  textArea.addEventListener('click', () => {
    textArea.select();
  });

  topBar.append(title, closeButton);
  body.append(textArea);
  modal.append(topBar, body);
  wrapper.append(modal);
  wrapper.addEventListener('click', (e) => {
    if (e.target === wrapper) closeModal();
  });
  document.body.appendChild(wrapper);

  return wrapper;
}

export function showModal(content: string): void {
  const wrapper = document.getElementById(WRAPPER_ID) ?? createModal();
  wrapper.style.display = 'block';
  const textArea = document.getElementById(TEXTAREA_ID);
  if (textArea instanceof HTMLTextAreaElement) textArea.value = content;
}
