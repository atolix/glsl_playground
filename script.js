let codeVisible = true;
let fragmentEditor;
let gl;
let program;
let startTime;
let animationFrameId;
let isPlaying = false; // Flag indicating if the shader is running
let pausedTime = 0; // Saved elapsed time when paused

// Fullscreen quad vertex array
const fullscreenVertices = new Float32Array([
  -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
]);

// Initialize when page loads
window.onload = function () {
  initCodeEditor();
  initWebGL();
  updatePlayButton();

  // iOS PWA キーボード対策: タップイベントを追加（遅延実行）
  setTimeout(() => {
    document.addEventListener("click", handleTapForKeyboard);

    // エディタ領域に直接クリックイベントを追加
    const editorElement = document.querySelector(".CodeMirror");
    if (editorElement) {
      editorElement.addEventListener(
        "touchend",
        function (e) {
          setTimeout(() => {
            fragmentEditor.focus();
            const textarea = fragmentEditor.getInputField();
            textarea.focus();
            // 仮想キーボードを強制的に表示
            textarea.click();
          }, 50);
        },
        false
      );
    }
  }, 1000);
};

// iOSのPWAでキーボードを表示させるためのハンドラー
function handleTapForKeyboard(e) {
  // CodeMirrorエディタ領域がクリックされたかを確認
  const editorElement = document.querySelector(".CodeMirror");
  if (editorElement && editorElement.contains(e.target)) {
    if (fragmentEditor) {
      // フォーカスを強制的に設定
      fragmentEditor.focus();

      // iOS PWA対策を強化
      const textarea = fragmentEditor.getInputField();
      textarea.readOnly = false;
      textarea.setAttribute("readonly", false);
      textarea.setAttribute("inputmode", "text");

      // フォーカスを遅延設定（iOS対策）
      setTimeout(() => {
        textarea.focus();
        // モバイルブラウザでキーボードを表示させるため、もう一度クリックイベントを発生
        textarea.click();

        // 選択範囲をクリアしてカーソルだけを表示
        if (textarea.setSelectionRange) {
          const len = textarea.value.length;
          textarea.setSelectionRange(len, len);
        }
      }, 100);
    }
  }
}

// Initialize CodeMirror editor for fragment shader
function initCodeEditor() {
  const fragmentTextArea = document.getElementById("fragmentCode");

  // iOSのPWA対策として、textareaの属性を先に設定
  fragmentTextArea.setAttribute("inputmode", "text");
  fragmentTextArea.setAttribute("autocomplete", "off");
  fragmentTextArea.setAttribute("autocorrect", "off");
  fragmentTextArea.setAttribute("autocapitalize", "off");
  fragmentTextArea.setAttribute("spellcheck", "false");
  fragmentTextArea.style.fontSize = "16px"; // iOS自動ズーム防止に16px以上のフォントサイズが必要

  fragmentEditor = CodeMirror.fromTextArea(fragmentTextArea, {
    mode: "x-shader/x-fragment",
    theme: "custom-github-dark", // Using custom GitHub Dark theme
    lineNumbers: true, // Show line numbers
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true,
    readOnly: false, // 編集可能に設定
    inputStyle: "contenteditable", // iOSでのキーボード表示に有効
    viewportMargin: Infinity, // エディタの高さを自動調整
    autofocus: true, // 自動フォーカス
  });

  // iOS PWAキーボード表示対策を追加
  const cmInput = fragmentEditor.getInputField();
  cmInput.setAttribute("inputmode", "text");
  cmInput.setAttribute("autocomplete", "off");
  cmInput.setAttribute("autocorrect", "off");
  cmInput.setAttribute("autocapitalize", "off");
  cmInput.setAttribute("spellcheck", "false");
  cmInput.style.fontSize = "16px"; // iOS自動ズーム防止

  // エディタがレンダリングされた後に再度フォーカスをセット
  setTimeout(() => {
    fragmentEditor.refresh();
    fragmentEditor.focus();
  }, 500);
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

  // Try to get WebGL2 context first, fall back to WebGL1 if necessary
  gl = canvas.getContext("webgl2");
  if (!gl) {
    console.warn("WebGL 2.0 not available. Falling back to WebGL 1.0.");
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      alert("WebGL is not available. Your browser may not support WebGL.");
      return;
    }
  } else {
    console.log("Successfully obtained WebGL 2.0 context.");
  }

  // Create a fullscreen quad
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fullscreenVertices, gl.STATIC_DRAW);

  // Set initial time
  startTime = Date.now();
}

// Get WebGL version information for debugging
function getWebGLVersionInfo() {
  if (!gl) return "WebGL context not initialized";

  const isWebGL2 = gl instanceof WebGL2RenderingContext;
  const glVersion = gl.getParameter(gl.VERSION);
  const glslVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

  return `WebGL: ${
    isWebGL2 ? "2.0" : "1.0"
  }, ${glVersion}, GLSL: ${glslVersion}`;
}

// Compile shader with error handling
function compileShader(source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    const shaderType =
      type === gl.VERTEX_SHADER ? "Vertex shader" : "Fragment shader";
    const errorMessage = `${shaderType} compilation error:\n${info}`;
    console.error(errorMessage);
    gl.deleteShader(shader);
    throw new Error(errorMessage);
  }
  return shader;
}

// Toggle shader execution
function toggleShader() {
  if (isPlaying) {
    stopShader();
  } else {
    runShader();
  }
  updatePlayButton();
}

// Update the play/stop button text
function updatePlayButton() {
  const playButton = document.querySelector(".buttons button:nth-child(1)");
  playButton.textContent = isPlaying ? "Stop" : "Play";
}

// Stop the shader
function stopShader() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  // Record elapsed time when stopped
  pausedTime = (Date.now() - startTime) / 1000;
  isPlaying = false;
}

// Run the shader with error handling
function runShader() {
  // Cancel any existing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  try {
    console.log(getWebGLVersionInfo()); // Log WebGL version information

    // Default vertex shader for both WebGL 1.0 and 2.0
    const vertexShaderSource =
      gl instanceof WebGL2RenderingContext
        ? `#version 300 es
         in vec2 a_position;
         void main() {
           gl_Position = vec4(a_position, 0, 1);
         }`
        : `attribute vec2 a_position;
         void main() {
           gl_Position = vec4(a_position, 0, 1);
         }`;

    // Get fragment shader code from editor
    const fragmentShaderSource = fragmentEditor.getValue();

    // Automatically handle WebGL version compatibility
    let processedFragmentSource = fragmentShaderSource;
    if (gl instanceof WebGL2RenderingContext) {
      // For WebGL2, add #version 300 es at the beginning if not already present
      if (!processedFragmentSource.trim().startsWith("#version 300 es")) {
        processedFragmentSource =
          "#version 300 es\nprecision highp float;\n" +
          processedFragmentSource.replace(/precision\s+highp\s+float\s*;/g, ""); // Remove duplicate precision declarations
      }
      console.log("Using WebGL 2.0 with #version 300 es");
    } else {
      // For WebGL1, remove #version 300 es line and outColor definition
      processedFragmentSource = processedFragmentSource
        .replace(/#version 300 es\s*/g, "")
        .replace(/out\s+vec4\s+outColor\s*;/g, "");

      // Add precision declaration if not present
      if (!processedFragmentSource.includes("precision highp float")) {
        processedFragmentSource =
          "precision highp float;\n" + processedFragmentSource;
      }

      // Use gl_FragColor instead of outColor
      processedFragmentSource = processedFragmentSource.replace(
        /outColor\s*=/g,
        "gl_FragColor ="
      );
      console.log(
        "Using WebGL 1.0 - removed version declaration and adapted output variable"
      );
    }

    // Display actual shader code used for debugging
    console.log("---------- SHADER CODE BEING USED ----------");
    console.log(processedFragmentSource);
    console.log("---------------------------------------------");

    // Compile the vertex shader
    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);

    // Compile the fragment shader
    const fragmentShader = compileShader(
      processedFragmentSource,
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
      throw new Error(`Shader program link error:\n${info}`);
    }

    // Set up program
    gl.useProgram(program);

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // Enable attributes with WebGL version check
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Use saved time if resuming
    if (pausedTime > 0) {
      startTime = Date.now() - pausedTime * 1000;
    } else {
      startTime = Date.now();
    }

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
    isPlaying = true;
  } catch (error) {
    console.error(error);
    alert("Shader Error: " + error.message);
    isPlaying = false;
    updatePlayButton();
  }
}

// Handle window resize
window.addEventListener("resize", function () {
  if (gl) {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
  }
});
