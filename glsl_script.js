let codeVisible = true;
let fragmentEditor;
let gl;
let program;
let startTime;
let animationFrameId;

// 全画面描画用の頂点配列
const fullscreenVertices = new Float32Array([
  -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
]);

// 全画面描画用のシェーダーコード
const fullscreenVertexShaderSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0, 1);
}`;

// Initialize when page loads
window.onload = function () {
  initCodeEditor();
  initWebGL();
  runShader();
};

// Initialize CodeMirror editor for fragment shader
function initCodeEditor() {
  const fragmentTextArea = document.getElementById("fragmentCode");
  fragmentEditor = CodeMirror.fromTextArea(fragmentTextArea, {
    mode: "x-shader/x-fragment",
    theme: "dracula",
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true,
  });
}

// Toggle visibility of the code editor
function toggleCode() {
  const codeContainer = document.getElementById("codeContainer");
  const controlPanel = document.getElementById("controlPanel");
  const toggleButton = document.querySelector(".buttons button:nth-child(2)");

  codeVisible = !codeVisible;

  if (codeVisible) {
    codeContainer.style.display = "block";
    controlPanel.style.background = "transparent";
    controlPanel.style.padding = "20px";
    toggleButton.textContent = "Hide Editor";
    fragmentEditor.refresh();
  } else {
    codeContainer.style.display = "none";
    controlPanel.style.background = "transparent";
    controlPanel.style.padding = "10px";
    toggleButton.textContent = "Show Editor";
  }
}

// Initialize WebGL context
function initWebGL() {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.getElementById("glCanvas").appendChild(canvas);

  // Get WebGL context
  gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
    return;
  }

  // Create a fullscreen quad
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fullscreenVertices, gl.STATIC_DRAW);

  // Set initial time
  startTime = Date.now();
}

// Compile shader
function compileShader(source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Could not compile shader:\n" + info);
  }
  return shader;
}

// Run the shader
function runShader() {
  // Cancel any existing animation loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  try {
    // フラグメントシェーダーのコードを取得
    const fragmentShaderSource = fragmentEditor.getValue();

    // 内部で使用する頂点シェーダーをコンパイル（表示しない）
    const vertexShader = compileShader(
      fullscreenVertexShaderSource,
      gl.VERTEX_SHADER
    );

    // フラグメントシェーダーをコンパイル
    const fragmentShader = compileShader(
      fragmentShaderSource,
      gl.FRAGMENT_SHADER
    );

    // Create program
    if (program) {
      gl.deleteProgram(program);
    }
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error("Could not link program:\n" + info);
    }

    // Set up program
    gl.useProgram(program);

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // Enable attributes
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Animation loop
    function render() {
      // Set viewport
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      // Clear canvas
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Set uniforms
      const time = (Date.now() - startTime) / 1000;
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Request next frame
      animationFrameId = requestAnimationFrame(render);
    }

    // Start animation loop
    render();
  } catch (error) {
    console.error(error);
    alert("Shader Error: " + error.message);
  }
}

// Handle window resize
window.addEventListener("resize", function () {
  if (gl) {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
  }
});
