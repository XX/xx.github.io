var sokoban = (function() {
    
    this.Field = function(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        
        this.cells = new Array(rows);
        for (var i = 0; i < rows; ++i) {
            this.cells[i] = new Array(cols);
        }
    };
    
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    
    this.Game = function(config) {
        var levels = sokoban.Level.parse(config.levels);
        var currentLevelIndex = 0;
        var resourcePath = config.resPath;
        var totalMovements = 0;
        
        var canvasId = config.canvasId;
        var helper = sokoban.util.GLHelper;
        var graph = new sokoban.util.Graphics();
        var beginAnimation = new sokoban.util.Animation();
        var spaceMode = false;
        
        var pressedKeys = [];
        var mouse = {
            button: [0, 0, 0],
            lastX: null,
            lastY: null,
            isDown: function () {
                return this.button[0] || this.button[1] || this.button[0];
            }
        };
        
        this.start = function() {
            init();
            setTimeout(function() {
                loop();
            }, 100);
        };
        
        function loop() {
            requestAnimFrame(loop);
            handleKeys();
            draw();
        }
        
        function init() {
            var canvas = document.getElementById(canvasId);
            
            graph.gl = helper.createGL(canvas);
            initShaders();
            initLevel();
            initInput();

            var gl = graph.gl;
            gl.clearColor(0.9, 0.9, 1.0, 1.0);
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
            
            gl.depthFunc(gl.LEQUAL);
            // TODO: http://stackoverflow.com/questions/15242507/perspective-correct-texturing-of-trapezoid-in-opengl-es-2-0
            // gl.hint(gl.PERSPECTIVE_CORRECTION_HINT, gl.NICEST);
        };
        
        function initShaders() {
            var gl = graph.gl;
            var shaderProgram = graph.shaderProgram;
            
            var fragmentShader = helper.getShader(gl, fragmentSh);
            var vertexShader = helper.getShader(gl, vertexSh);
                        
            shaderProgram = gl.createProgram();
            
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                alert("Could not initialise shaders");
            }

            gl.useProgram(shaderProgram);

            shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
            gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

            shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
            gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
            
            shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
            gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

            shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
            shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
            shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
            shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
            shaderProgram.vertexColorUniform = gl.getUniformLocation(shaderProgram, "uVertexColor");
            shaderProgram.isLightNotUseUniform = gl.getUniformLocation(shaderProgram, "uIsLightNotUse");
            
            graph.shaderProgram = shaderProgram;
        }
        
        function showCompleteMessage(isShow) {
            var messageId = document.getElementById(config.messageId);
            if (isShow) {
                messageId.style.visibility = "visible";
            } else {
                messageId.style.visibility = "hidden";
            }
        }
        
        function setLevelNumberText() {
            config.levelNumberIds.forEach(function(id) {
                document.getElementById(id).innerHTML =
                        levels[currentLevelIndex].number;
            });
        }
        
        function setLevelMovementsText() {
            setTimeout(function() {
                document.getElementById(config.levelMovingsId).innerHTML =
                    levels[currentLevelIndex].getMoves();
            }, 0);
        }
        
        function setTotalMovementsText() {
            document.getElementById(config.totalMovingsId).innerHTML = totalMovements;
        }
        
        function initLevel() {
            showCompleteMessage(false);
            
            setLevelNumberText();
            setLevelMovementsText();
            setTotalMovementsText();
            
            initObjects();
            initTextures();
            initAnimation();
        }
        
        function initObjects() {
            sokoban.util.ModelManager.resourcePath = resourcePath;
            levels[currentLevelIndex].initObjects(graph);
        }
        
        function initTextures() {
            sokoban.util.TextureManager.loadTextures(graph, resourcePath);
        }
        
        function initAnimation() {
            var animation = beginAnimation;
            
            animation.rx.start = 37.5;
            animation.rx.end = 90.0;
            animation.rx.current = animation.rx.start;

            animation.ry.start = 37.0;
            animation.ry.end = 0.0;
            animation.ry.current = animation.ry.start;

            animation.tz.start = -10.0;
            animation.tz.end = -4.0;
            animation.tz.current = animation.tz.start;
            
            animation.speed = 0.002;
            animation.calculateTransform();
        }
        
        function cameraPosition() {
            var animation = beginAnimation;
            
            animation.rx.start = animation.rx.current;
            animation.ry.start = animation.ry.current;
            animation.tz.start = animation.tz.current;

            if (spaceMode) {
                animation.rx.end = animation.rx.old;
                animation.ry.end = animation.ry.old;
                animation.tz.end = animation.tz.old;
            } else {
                animation.rx.old = animation.rx.current;
                animation.ry.old = animation.ry.current;
                animation.tz.old = animation.tz.current;

                animation.rx.end = 90.0;
                animation.ry.end = 0.0;
                animation.tz.end = -4.0;
            }
            animation.calculateTransform();
            
        }
        
        function animate() {
            var animation = beginAnimation;
            animation.animate();
            graph.translate(animation.tx.current, animation.ty.current, animation.tz.current);
            graph.rotate(graph.degToRad(animation.rx.current), [1, 0, 0]);
            graph.rotate(graph.degToRad(animation.ry.current), [0, 1, 0]);
            graph.rotate(graph.degToRad(animation.rz.current), [0, 0, 1]);
        };
        
        function initInput() {
            document.onkeydown = handleKeyDown;
            document.onkeyup = handleKeyUp;
            
            canvas = document.getElementById(canvasId);
            canvas.onmousedown = handleMouseDown;
            
            document.onmouseup = handleMouseUp;
            document.onmousemove = handleMouseMove;
        }
        
        function move(dir) {
            levels[currentLevelIndex].move(dir);
            setLevelMovementsText();
        }

        function handleKeyDown(event) {
            pressedKeys[event.keyCode] = true;
            // Space
            if (event.keyCode === 32) {
                cameraPosition();
            }
            // Backspace
            if (event.keyCode === 8) {
                levels[currentLevelIndex].reset();
                setLevelMovementsText();
            }
        }

        function handleKeyUp(event) {
            pressedKeys[event.keyCode] = false;
            // Space
            if (event.keyCode === 32) {
                spaceMode = !spaceMode;
            }
        }
        
        function handleKeys() {
            if (pressedKeys[37] || pressedKeys[65]) {
                // Left cursor key
                // or A key
                move([0, -1]);
            }
            if (pressedKeys[39] || pressedKeys[68]) {
                // Right cursor key
                // or D key
                move([0, 1]);
            }
            if (pressedKeys[38] || pressedKeys[87]) {
                // Up cursor key
                // or W key
                move([-1, 0]);
            }
            if (pressedKeys[40] || pressedKeys[83]) {
                // Down cursor key
                // or S key
                move([1, 0]);
            }
            if (pressedKeys[33]) {
                // PgUp key
                beginAnimation.tz.current += 0.1;
                beginAnimation.tz.end = beginAnimation.tz.current;
            }
            if (pressedKeys[34]) {
                // PgDn key
                beginAnimation.tz.current -= 0.1;
                beginAnimation.tz.end = beginAnimation.tz.current;
            }
        }

        var moonRotationMatrix = mat4.create();
        mat4.identity(moonRotationMatrix);

        function handleMouseDown(event) {
            mouse.button[event.button] = true;
            mouse.lastX = event.clientX;
            mouse.lastY = event.clientY;
        }

        function handleMouseUp(event) {
            mouse.button[event.button] = false;
        }

        function handleMouseMove(event) {
            if (!mouse.isDown()) {
                return;
            }
            var newX = event.clientX;
            var newY = event.clientY;

            var animation = beginAnimation;
            if (mouse.button[0]) { //Если опущена левая кнопка при перемещении
                if (mouse.lastX > newX) animation.ry.current -= (mouse.lastX - newX) / 2; //Вычисляем новые значения углов,
                if (mouse.lastX < newX) animation.ry.current += (newX - mouse.lastX) / 2; //учитывая смещение курсора относительно
                if (mouse.lastY > newY) animation.rx.current -= (mouse.lastY - newY) / 2; //предыдущего положения
                if (mouse.lastY < newY) animation.rx.current += (newY - mouse.lastY) / 2;
                animation.rx.end = animation.rx.current;
                animation.ry.end = animation.ry.current;
            }
            if (mouse.button[1]) { //Если опущена средняя кнопка при перемещении
                if (mouse.lastY > newY) animation.tz.current += 0.1; //Если мышь перемещаем вверх, то приближаемся
                if (mouse.lastY < newY) animation.tz.current -= 0.1; //Если мышь перемещаем вниз, то удаляемся
                animation.tz.end = animation.tz.current;
            }
            spaceMode = false;
            
            mouse.lastX = newX;
            mouse.lastY = newY;
        }
        
        function draw() {
            var gl = graph.gl;
            
            gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            graph.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
            graph.identity();
            
            animate();
            levels[currentLevelIndex].draw(graph);
            logic();
        }
        
        function logic() {
            if (levels[currentLevelIndex].isLevelComplete()) {
                showCompleteMessage(true);
                if (pressedKeys[13]) {
                    totalMovements += levels[currentLevelIndex].getMoves();
                    if (nextLevel()) {
                        initLevel();
                    } else {
                        //game.exit();
                    }
                }
            }
        }
        
        function nextLevel() {
            if (++currentLevelIndex >= levels.length) {
                currentLevelIndex = levels.length - 1;
                return false;
            }
            return true;
        }
        
    };
    
    return this;
}).call(sokoban || {});

var sokoban = (function() {
    
    var testLevel = {
        number: 0,
        plan: ["OOOOO",
               "O--*O",
               "O-#+O",
               "OOOOO"]
    };
    
    var Level1 = {
        number: 1,
        plan: ["----OOOOO----------",
               "----O---O----------",
               "----O#--O----------",
               "--OOO--#OO---------",
               "--O--#-#-O---------",
               "OOO-O-OO-O---OOOOOO",
               "O---O-OO-OOOOO--++O",
               "O-#--#----------++O",
               "OOOOO-OOO-O*OO--++O",
               "----O-----OOOOOOOOO",
               "----OOOOOOO--------"]
    };
    
    var Level2 = {
        number: 2,
        plan: ["OOOOOOOOOOOO--",
               "O++--O-----OOO",
               "O++--O-#--#--O",
               "O++--O#OOOO--O",
               "O++------OO--O",
               "O++--O-O*-#-OO",
               "OOOOOO-OO#-#-O",
               "--O-#--#-#-#-O",
               "--O----O-----O",
               "--OOOOOOOOOOOO"]
    };

    var Level3 = {
        number: 3,
        plan: ["--------OOOOOOOO-",
               "--------O-----*O-",
               "--------O-#O#-OO-",
               "--------O-#--#O--",
               "--------OO#-#-O--",
               "OOOOOOOOO-#-O-OOO",
               "O++++--OO-#--#--O",
               "OO+++----#--#---O",
               "O++++--OOOOOOOOOO",
               "OOOOOOOO---------"]
    };
    
    var Level4 = {
        number: 4,
        plan: ["--------------OOOOOOOO",
               "--------------O--++++O",
               "---OOOOOOOOOOOO--++++O",
               "---O----O--#-#---++++O",
               "---O-###O#--#-O--++++O",
               "---O--#-----#-O--++++O",
               "---O-##-O#-#-#OOOOOOOO",
               "OOOO--#-O-----O-------",
               "O---O-OOOOOOOOO-------",
               "O----#--OO------------",
               "O-##O##-*O------------",
               "O---O---OO------------",
               "OOOOOOOOO-------------"]
    };
    
    var Level5 = {
        number: 5,
        plan: ["--------OOOOO----",
               "--------O---OOOOO",
               "--------O-O#OO--O",
               "--------O-----#-O",
               "OOOOOOOOO-OOO---O",
               "O++++--OO-#--#OOO",
               "O++++----#-##-OO-",
               "O++++--OO#--#-*O-",
               "OOOOOOOOO--#--OO-",
               "--------O-#-#--O-",
               "--------OOO-OO-O-",
               "----------O----O-",
               "----------OOOOOO-"]
    };

    var config = {
        levels: [testLevel, Level1, Level2, Level3, Level4, Level5]
    };
    
    this.GameRunner = function(params) {
        
        for (var key in params) {
            config[key] = params[key];
        }
        this.game = new sokoban.Game(config);
        
        this.run = function() {
            this.game.start();
        };
    };
    
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    
    var SCALE = 0.2;
    
    this.Level = function(rows, cols) {
        this.number = null;
        this.startText = null;
        this.endText = null;
        this.field = new sokoban.Field(rows, cols);
                
        var isWin = false;
        var doker = null;
        
        var movement = [];
        var moves = 0;
        var pushes = 0;
        
        this.getMoves = function () {
            return moves;
        };
        
        this.isLevelComplete = function () {
            return isWin;
        };
        
        this.initObjects = function (graph) {
            var cells = this.field.cells;
            for (var i = 0; i < cells.length; ++i) {
                for (var j = 0; j < cells[i].length; ++j) {
                    cells[i][j].init(graph);
                }
            }
        };
        
        this.draw = function (graph) {
            var gl = graph.gl;
            var rows = this.field.rows;
            var cols = this.field.cols;
            var cells = this.field.cells;
            
            var shiftX = -cols * SCALE * 0.5;
            var shiftZ = -rows * SCALE * 0.5;

            isWin = true;
            for (var i = 0; i < rows; ++i) {
                for (var j = 0; j < cols; ++j) {
                    if (cells[i][j].char === sokoban.cell.Doker.char) {
                        doker = cells[i][j];
                        doker.posRow = i;
                        doker.posCol = j;
                        if (cells[i][j].underCell.char === sokoban.cell.Place.char) {
                            isWin = false;
                        }
                    } else if (cells[i][j].char === sokoban.cell.Box.char) {
                        cells[i][j].posRow = i;
                        cells[i][j].posCol = j;
                    } else if (isWin && cells[i][j].char === sokoban.cell.Place.char) {
                        isWin = false;
                    }
                    
                    graph.pushMvMatrix();
                    
                    graph.translate(j * SCALE + shiftX, 0.0, i * SCALE + shiftZ);
                    graph.scale(SCALE, SCALE, SCALE);
                    
                    cells[i][j].draw(graph);
                    
                    graph.popMvMatrix();
                }
            }
        };
    
        this.move = function(dir) {
            var cells = this.field.cells;

            if (!doker.animation.isPlayback()) {
                if (cells[doker.posRow + dir[0]][doker.posCol + dir[1]].char === sokoban.cell.Space.char
                        || cells[doker.posRow + dir[0]][doker.posCol + dir[1]].char === sokoban.cell.Place.char) {
                    
                    movement.push(
                            doker.move(this.field, dir));
                    
                    moves++;
                } else if (cells[doker.posRow + dir[0]][doker.posCol + dir[1]].char === sokoban.cell.Box.char
                        && (cells[doker.posRow + dir[0] * 2][doker.posCol + dir[1] * 2].char === sokoban.cell.Place.char
                        || cells[doker.posRow + dir[0] * 2][doker.posCol + dir[1] * 2].char === sokoban.cell.Space.char)) {
                    
                    var box = cells[doker.posRow + dir[0]][doker.posCol + dir[1]];
                    var oldState = box.onPlace;
                    
                    movement.push(
                            box.move(this.field, dir));
                    
                    if (oldState !== box.onPlace) {
                        box.onPlace ? pushes++ : pushes--;
                    }
                    
                    movement.push(
                            doker.move(this.field, dir));
                    
                    moves++;
                }
            }
        };
        
        this.reset = function() {
            moves = 0;
            pushes = 0;
            var cells = this.field.cells;
            for (var i = movement.length - 1; i >= 0; --i) {
                var move = movement[i];
                var tempCell = cells[move.fromRow][move.fromCol];

                cells[move.fromRow][move.fromCol] = cells[move.toRow][move.toCol];
                cells[move.toRow][move.toCol] = cells[move.toRow][move.toCol].underCell;
                cells[move.fromRow][move.fromCol].underCell = tempCell;
            }
            movement = [];
        };

    };
    
    this.Level.parse = function (configLevels) {
        
        function parseLevel(configLevel) {
            var level = new sokoban.Level(configLevel.plan.length, configLevel.plan[0].length);
            level.number = configLevel.number;
            level.startText = configLevel.startText;
            level.endText = configLevel.endText;
            
            for (var i = 0; i < level.field.rows; ++i) {
                var line = configLevel.plan[i];
                for (var j = 0; j < level.field.cols; ++j) {
                    level.field.cells[i][j] = sokoban.Level.parseCell(line[j]);
                }
            }
            
            return level;
        }
        
        var levels = [];

        configLevels.forEach(function(configLevel) {
            levels.push(parseLevel(configLevel));
        });

        return levels;
    };
    
    this.Level.parseCell = function (ch) {
        var cell = null;

        switch (ch) {
            case sokoban.cell.Space.char:
                cell = new sokoban.cell.Space();
                break;
            case sokoban.cell.Wall.char:
                cell = new sokoban.cell.Wall();
                break;
            case sokoban.cell.Box.char:
                cell = new sokoban.cell.Box();
                break;
            case sokoban.cell.Place.char:
                cell = new sokoban.cell.Place();
                break;
            case sokoban.cell.Doker.char:
                cell = new sokoban.cell.Doker();
                break;
            default:
                cell = new sokoban.cell.Space();
                break;
        }

        return cell;
    };
    
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.cell = (function() {
        
        var BOX_CHAR = '#';
        
        this.Box = function () {
            var prototype = new sokoban.cell.Cube("img/crate.gif", null);
            for (var property in prototype) this[property] = prototype[property];
            
            this.char = BOX_CHAR;
            this.onPlace = false;
            this.posRow = 0;
            this.posCol = 0;
            
            var moveSpeed = 0.01;
            
            this.move = function (field, dir) {
                var newRow = this.posRow + dir[0];
                var newCol = this.posCol + dir[1];
                var startTx = -dir[1];
                var startTz = -dir[0];
                
                var tempCell = field.cells[newRow][newCol];

                field.cells[newRow][newCol] = this;
                field.cells[this.posRow][this.posCol] = this.underCell;
                this.posRow = newRow;
                this.posCol = newCol;
                this.underCell = tempCell;
                
                if (field.cells[this.posRow][this.posCol].char !== sokoban.cell.Place.char
                        && field.cells[newRow][newCol].underCell.char === sokoban.cell.Place.char) {
                    this.onPlace = true;
                } else if (field.cells[this.posRow][this.posCol].char === sokoban.cell.Place.char
                        && field.cells[newRow][newCol].underCell.char !== sokoban.cell.Place.char) {
                    this.onPlace = false;
                }

                this.animation.tx.start = startTx;
                this.animation.tx.current = startTx;
                this.animation.tx.end = 0.0;
                this.animation.tx.calculateTransform(moveSpeed);

                this.animation.tz.start = startTz;
                this.animation.tz.current = startTz;
                this.animation.tz.end = 0.0;
                this.animation.tz.calculateTransform(moveSpeed);

                this.animation.beginAnimate = true;
                
                return {
                    fromRow: newRow - dir[0],
                    fromCol: newCol - dir[1],
                    toRow: newRow,
                    toCol: newCol
                };
            };
            
        };
        
        this.Box.char = BOX_CHAR;
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    this.cell = (function() {
        
        this.Cube = function(texturePath, color) {
            this.underCell = new sokoban.cell.Space();
            this.animation = new sokoban.util.Animation();
            this.texturePath = texturePath || null;
            this.texture = null;
            this.color = color || new Float32Array([1, 1, 1, 1]); // white (empty) color
            
            var positionBuffer = null;
            var textureCoordBuffer = null;
            var indexBuffer = null;
            var normalBuffer = null;
                        
            this.init = function (graph) {
                initBuffers(graph);
                sokoban.util.TextureManager.addTexturedObject(this);
            };
            
            this.loadTexture = function (graph) {
                if (this.texturePath !== null) {
                    this.texture = sokoban.util.TextureManager.readTexture(graph, this.texturePath);
                } else {
                    this.texture = sokoban.util.TextureManager.loadEmptyTexture(graph);
                }
            };
            
            this.draw = function (graph) {
                var gl = graph.gl;
                
                graph.pushMvMatrix();
                
                this.underCell.draw(graph);
                this.animation.animate();
                
                graph.translate(this.animation.tx.current, this.animation.ty.current, this.animation.tz.current);
                graph.rotate(graph.degToRad(this.animation.rx.current), [1, 0, 0]);
                graph.rotate(graph.degToRad(this.animation.ry.current), [0, 1, 0]);
                graph.rotate(graph.degToRad(this.animation.rz.current), [0, 0, 1]);

                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.vertexPositionAttribute,
                        positionBuffer.itemSize, gl.FLOAT, false, 0, 0);
                        
                gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.textureCoordAttribute,
                        textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
                                
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.uniform1i(graph.shaderProgram.samplerUniform, 0);

                gl.uniform4fv(graph.shaderProgram.vertexColorUniform, this.color);
                gl.uniform1i(graph.shaderProgram.isLightNotUseUniform, 0);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.vertexNormalAttribute,
                        normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
                
                gl.uniformMatrix3fv(graph.shaderProgram.nMatrixUniform, false, graph.getNormalMatrix());

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                graph.setMatrixUniforms();
                gl.drawElements(gl.TRIANGLES, indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);                
                
                graph.popMvMatrix();
            };
            
            function initBuffers(graph) {
                var gl = graph.gl;
                
                positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                var vertices = [
                    // Передняя грань
                    -0.5, -0.5,  0.5,
                     0.5, -0.5,  0.5,
                     0.5,  0.5,  0.5,
                    -0.5,  0.5,  0.5,

                    // Задняя грань
                    -0.5, -0.5, -0.5,
                    -0.5,  0.5, -0.5,
                     0.5,  0.5, -0.5,
                     0.5, -0.5, -0.5,

                    // Верхняя грань
                    -0.5,  0.5, -0.5,
                    -0.5,  0.5,  0.5,
                     0.5,  0.5,  0.5,
                     0.5,  0.5, -0.5,

                    // Нижняя грань
                    -0.5, -0.5, -0.5,
                     0.5, -0.5, -0.5,
                     0.5, -0.5,  0.5,
                    -0.5, -0.5,  0.5,

                    // Правая грань
                     0.5, -0.5, -0.5,
                     0.5,  0.5, -0.5,
                     0.5,  0.5,  0.5,
                     0.5, -0.5,  0.5,

                    // Левая грань
                    -0.5, -0.5, -0.5,
                    -0.5, -0.5,  0.5,
                    -0.5,  0.5,  0.5,
                    -0.5,  0.5, -0.5,
                ];
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
                positionBuffer.itemSize = 3;
                positionBuffer.numItems = 24;
                
                // Cube texture buffer
                textureCoordBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
                var textureCoords = [
                    // Front face
                    0.0, 0.0,
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,

                    // Back face
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,
                    0.0, 0.0,

                    // Top face
                    0.0, 1.0,
                    0.0, 0.0,
                    1.0, 0.0,
                    1.0, 1.0,

                    // Bottom face
                    1.0, 1.0,
                    0.0, 1.0,
                    0.0, 0.0,
                    1.0, 0.0,

                    // Right face
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,
                    0.0, 0.0,

                    // Left face
                    0.0, 0.0,
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,
                ];
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
                textureCoordBuffer.itemSize = 2;
                textureCoordBuffer.numItems = 24;
                
                // Cube index buffer
                indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                var cubeVertexIndices = [
                    0, 1, 2,      0, 2, 3,    // Front face
                    4, 5, 6,      4, 6, 7,    // Back face
                    8, 9, 10,     8, 10, 11,  // Top face
                    12, 13, 14,   12, 14, 15, // Bottom face
                    16, 17, 18,   16, 18, 19, // Right face
                    20, 21, 22,   20, 22, 23  // Left face
                ];
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
                indexBuffer.itemSize = 1;
                indexBuffer.numItems = 36;
                
                normalBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                var vertexNormals = [
                  // Front face
                   0.0,  0.0,  1.0,
                   0.0,  0.0,  1.0,
                   0.0,  0.0,  1.0,
                   0.0,  0.0,  1.0,

                  // Back face
                   0.0,  0.0, -1.0,
                   0.0,  0.0, -1.0,
                   0.0,  0.0, -1.0,
                   0.0,  0.0, -1.0,

                  // Top face
                   0.0,  1.0,  0.0,
                   0.0,  1.0,  0.0,
                   0.0,  1.0,  0.0,
                   0.0,  1.0,  0.0,

                  // Bottom face
                   0.0, -1.0,  0.0,
                   0.0, -1.0,  0.0,
                   0.0, -1.0,  0.0,
                   0.0, -1.0,  0.0,

                  // Right face
                   1.0,  0.0,  0.0,
                   1.0,  0.0,  0.0,
                   1.0,  0.0,  0.0,
                   1.0,  0.0,  0.0,

                  // Left face
                  -1.0,  0.0,  0.0,
                  -1.0,  0.0,  0.0,
                  -1.0,  0.0,  0.0,
                  -1.0,  0.0,  0.0,
                ];
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
                normalBuffer.itemSize = 3;
                normalBuffer.numItems = 24;
            }
            
        };
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    this.cell = (function() {
        
        var DOKER_CHAR = '*';
        
        this.Doker = function() {
            var prototype = new sokoban.util.Model(dokerModel, "img/doker.jpg");
            for (var property in prototype) this[property] = prototype[property];
            
            this.underCell = new sokoban.cell.Space();
            this.animation = new sokoban.util.Animation();
            
            this.char = DOKER_CHAR;
            this.posRow = 0;
            this.posCol = 0;
            
            var moveSpeed = 0.01;
            
            this.move = function (field, dir) {
                var newRow = this.posRow + dir[0];
                var newCol = this.posCol + dir[1];
                var startTx = -dir[1];
                var startTz = -dir[0];
                
                var tempCell = field.cells[newRow][newCol];

                field.cells[newRow][newCol] = this;
                field.cells[this.posRow][this.posCol] = this.underCell;
                this.posRow = newRow;
                this.posCol = newCol;
                this.underCell = tempCell;

                this.animation.tx.start = startTx;
                this.animation.tx.current = startTx;
                this.animation.tx.end = 0.0;
                this.animation.tx.calculateTransform(moveSpeed);

                this.animation.tz.start = startTz;
                this.animation.tz.current = startTz;
                this.animation.tz.end = 0.0;
                this.animation.tz.calculateTransform(moveSpeed);
                
                var angle = dir[0] * -90;
                if (angle === 0 && dir[1] !== 0) {
                    angle = dir[1] * -90 + 90;
                } 
                this.animation.ry.start = angle;
                this.animation.ry.current = angle;
                this.animation.ry.end = angle;

                this.animation.beginAnimate = true;
                
                return {
                    fromRow: newRow - dir[0],
                    fromCol: newCol - dir[1],
                    toRow: newRow,
                    toCol: newCol
                };
            };
            
        };
        
        this.Doker.char = DOKER_CHAR;
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    this.cell = (function() {
        
        var PLACE_CHAR = '+';
        
        this.Place = function() {
            this.char = PLACE_CHAR;
            this.underCell = new sokoban.cell.Space();
            this.animation = new sokoban.util.Animation();
            this.texture = null;
            this.color = new Float32Array([0, 0, 0.9, 1]);
            
            var positionBuffer = null;
            var indexBuffer = null;
            
            sokoban.util.TextureManager.addTexturedObject(this);
            
            this.init = function (graph) {
                initBuffers(graph);
            };
            
            this.loadTexture = function (graph) {
                this.texture = sokoban.util.TextureManager.loadEmptyTexture(graph);
            };
            
            this.draw = function (graph) {
                var gl = graph.gl;
                
                graph.pushMvMatrix();
                
                this.underCell.draw(graph);
                this.animation.animate();
                
                graph.translate(this.animation.tx.current, this.animation.ty.current, this.animation.tz.current);
                graph.rotate(graph.degToRad(this.animation.rx.current), [1, 0, 0]);
                graph.rotate(graph.degToRad(this.animation.ry.current), [0, 1, 0]);
                graph.rotate(graph.degToRad(this.animation.rz.current), [0, 0, 1]);

                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.vertexPositionAttribute,
                        positionBuffer.itemSize, gl.FLOAT, false, 0, 0);

                gl.uniform4fv(graph.shaderProgram.vertexColorUniform, this.color);
                gl.uniform1i(graph.shaderProgram.isLightNotUseUniform, 1);
                
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.uniform1i(graph.shaderProgram.samplerUniform, 0);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                graph.setMatrixUniforms();
                gl.drawElements(gl.LINE_STRIP, indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
                
                graph.popMvMatrix();
            };
            
            function initBuffers(graph) {
                var gl = graph.gl;
                
                positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                var vertices = [
                    -0.4,  0.0,  0.0,
                     0.0,  0.0,  0.2,
                     0.4,  0.0,  0.0,
                     0.0,  0.0, -0.2,
                ];
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
                positionBuffer.itemSize = 3;
                positionBuffer.numItems = vertices.length / positionBuffer.itemSize;
                
                indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                var vertexIndices = [
                    0, 1,
                    1, 2,
                    2, 3,
                    3, 0
                ];
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
                indexBuffer.itemSize = 1;
                indexBuffer.numItems = vertexIndices.length / indexBuffer.itemSize;
            }
            
        };
        
        this.Place.char = PLACE_CHAR;
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    this.cell = (function() {
        
        var SPACE_CHAR = '-';
        
        this.Space = function() {
            this.char = SPACE_CHAR;
            this.underCell = this;
            
            this.init = function(graph) {
                // Free space
            };
            
            this.draw = function(graph) {
                // Free space
            };
        };
        
        this.Space.char = SPACE_CHAR;
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
    this.cell = (function() {
        
        var WALL_CHAR = 'O';
        
        this.Wall = function () {
            var prototype = new sokoban.cell.Cube("img/cwall.jpg", null);
            for (var property in prototype) this[property] = prototype[property];
            
            this.char = WALL_CHAR;
        };
        
        this.Wall.char = WALL_CHAR;
        
    
        return this;
    }).call(this.cell || {});
    return this;
}).call(sokoban || {}); 

var sokoban = (function() {
        
    var imports = [
        {type: "res", fileName: "obj/doker.json.js"},
        {type: "mod", fileName: "shader/fragment.js"},
        {type: "mod", fileName: "shader/vertex.js"},
        {type: "mod", fileName: "util/GLHelper.js"},
        {type: "mod", fileName: "util/Graphics.js"},
        {type: "mod", fileName: "util/Animation.js"},
        {type: "mod", fileName: "util/AnimateParameter.js"},
        {type: "mod", fileName: "util/TextureManager.js"},
        {type: "mod", fileName: "util/ModelManager.js"},
        {type: "mod", fileName: "util/Model.js"},
        {type: "mod", fileName: "cell/Space.js"},
        {type: "mod", fileName: "cell/Cube.js"},
        {type: "mod", fileName: "cell/Box.js"},
        {type: "mod", fileName: "cell/Doker.js"},
        {type: "mod", fileName: "cell/Place.js"},
        {type: "mod", fileName: "cell/Wall.js"},
        {type: "mod", fileName: "Field.js"},
        {type: "mod", fileName: "Level.js"},
        {type: "mod", fileName: "Game.js"},
        {type: "mod", fileName: "GameRunner.js"},
        //{type: "test", fileName: "GameTest.js"}
    ];
    
    this.main = function(params) {
        var runner = new sokoban.GameRunner(params);
        runner.run();
    };
    
    this.mainDev = function(params) {
        var gamePath = params.gamePath;
        var libPath = params.libPath = params.libPath || gamePath + "/lib";
        var resPath = params.resPath = params.resPath || gamePath + "/res";
        var count = 0;
        
        imports.forEach(function (entry) {
            
            // Build script path
            var path = entry.fileName;
            if (entry.type === "mod") {
                path = gamePath + "/src/" + path;
            } else if (entry.type === "lib") {
                path = libPath + "/" + path;
            } else if (entry.type === "test") {
                path = gamePath + "/test/" + path;
            } else if (entry.type === "res") {
                path = resPath + "/" + path;
            }
            
            // Load script
            loadScript(path, function() {
                count++;
                if (count === imports.length) {
                    // All scripts loaded - run game
                    this.main(params);
                }
            });
        });
    };
    
    function loadScript(url, callback) {
        // Adding the script tag to the head as suggested before
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        script.onreadystatechange = callback;
        script.onload = callback;

        // Fire the loading
        head.appendChild(script);
    }
    
    return this;
}).call(sokoban || {});
var fragmentSh = {
    type: "fragment",
    program: (function () {/*
    #ifdef GL_ES
        precision mediump float;
    #endif

    varying vec2 vTextureCoord;
    varying vec3 vLightWeight;
    varying vec4 vColor;

    uniform sampler2D uSampler;

    void main(void) {
        vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
        vec4 color = vColor * textureColor;
        gl_FragColor = vec4(color.rgb * vLightWeight, color.a);
    }
    */}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1]
};
var vertexSh = {
    type: "vertex",
    program: (function () {/*
    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;
    attribute vec3 aVertexNormal;
    
    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;
    uniform mat3 uNMatrix;
    
    uniform vec4 uVertexColor;
    uniform int uIsLightNotUse;

    varying vec2 vTextureCoord;
    varying vec3 vLightWeight;
    varying vec4 vColor;

    void main(void) {
        gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
        vTextureCoord = aTextureCoord;
        vColor = uVertexColor;

        if (uIsLightNotUse != 0) {
            vLightWeight = vec3(1.0, 1.0, 1.0);
        } else {
            vec3 transformedNormal = uNMatrix * aVertexNormal;
            vec3 lightingDirection = vec3(0.25, 0.25, 0.5);
            vec3 ambientColor = vec3(0.6, 0.6, 0.6);
            vec3 directionalColor = vec3(0.3, 0.3, 0.3);

            float directionalLightWeight = max(dot(transformedNormal, lightingDirection), 0.0);
            vLightWeight = ambientColor + directionalColor * directionalLightWeight;
        }
    }
    */}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1]
};
var sokoban = (function() {
    this.util = (function() {
        
        var EPS = 0.0001;
        
        this.AnimateParameter = function() {
            this.start = 0;
            this.end = 0;
            this.old = 0;
            this.diff = 0;
            this.speed = 0;
            this.current = 0;
            
            this.calculateTransform = function(speed) {
                if (typeof speed === 'undefined') {
                    speed = 1;
                }
                this.diff = this.end > this.start ? 1.0 : -1.0;
                this.speed = (this.end - this.start) * speed;
            };

            this.nextStep = function(delta) {
                if ((this.end - this.current) * this.diff > EPS) {
                    var step = this.speed * delta;
                    this.current += step;
                    if ((this.end - this.current) * this.diff < EPS) {
                        this.current = this.end;
                    }
                } else {
                    this.current = this.end;
                }
            };
            
            this.isContinue = function () {
                return this.end !== this.current;
            };
        };
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {
        
        this.Animation = function() {
            this.beginAnimate = true;
            this.elapsedTime = 0;
            this.lastTime = 0;
            this.speed = 1;
            
            this.rx = new sokoban.util.AnimateParameter();
            this.ry = new sokoban.util.AnimateParameter();
            this.rz = new sokoban.util.AnimateParameter();
            
            this.tx = new sokoban.util.AnimateParameter();
            this.ty = new sokoban.util.AnimateParameter();
            this.tz = new sokoban.util.AnimateParameter();
            
            this.animate = function() {
                this.calculateTime();

                if (this.beginAnimate) {
                    this.beginAnimate = false;
                } else {
                    this.tx.nextStep(this.elapsedTime);
                    this.ty.nextStep(this.elapsedTime);
                    this.tz.nextStep(this.elapsedTime);

                    this.rx.nextStep(this.elapsedTime);
                    this.ry.nextStep(this.elapsedTime);
                    this.rz.nextStep(this.elapsedTime);
                }
            };
            
            this.isPlayback = function () {
                return this.tx.isContinue() ||
                        this.ty.isContinue() ||
                        this.tz.isContinue() ||
                        this.rx.isContinue() ||
                        this.ry.isContinue() ||
                        this.rz.isContinue();
            };
            
            this.calculateTime = function() {
                var nowTime = new Date().getTime();
                if (this.lastTime !== 0) {
                    this.elapsedTime = nowTime - this.lastTime;
                }
                this.lastTime = nowTime;
            };
            
            this.calculateTransform = function (speed) {
                speed = speed || this.speed;
                
                this.tx.calculateTransform(speed);
                this.ty.calculateTransform(speed);
                this.tz.calculateTransform(speed);

                this.rx.calculateTransform(speed);
                this.ry.calculateTransform(speed);
                this.rz.calculateTransform(speed);
            };
        };
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {

        this.GLHelper = function() {
        };

        this.GLHelper.createGL = function(canvas) {
            var gl = null;

            if (!window.WebGLRenderingContext) {
                // the browser doesn't even know what WebGL is
                window.location = "http://get.webgl.org";
            } else {
                gl = WebGLUtils.create3DContext(canvas, {antialias : true});
                if (!gl) {
                    // browser supports WebGL but initialization failed.
                    alert("Could not initialise WebGL, sorry :-(");
                    window.location = "http://get.webgl.org/troubleshooting";
                } else {
                    gl.viewportWidth = canvas.width;
                    gl.viewportHeight = canvas.height;
                }
            }

            return gl;
        };

        this.GLHelper.getShader = function(gl, shaderObject) {
            var shader;
            if (shaderObject.type === "fragment") {
                shader = gl.createShader(gl.FRAGMENT_SHADER);
            } else if (shaderObject.type === "vertex") {
                shader = gl.createShader(gl.VERTEX_SHADER);
            } else {
                return null;
            }

            gl.shaderSource(shader, shaderObject.program);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                alert(gl.getShaderInfoLog(shader));
                return null;
            }

            return shader;
        };

        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {
        
        this.Graphics = function() {
            this.mvMatrix = mat4.create();
            this.pMatrix = mat4.create();
            this.gl = null;
            this.shaderProgram = null;
            
            var matrixStack = [];
            
            this.getNormalMatrix = function () {
                var normalMatrix = mat3.create();
                mat3.normalFromMat4(normalMatrix, this.mvMatrix);
                
                return normalMatrix;
            };
            
            this.pushMatrix = function(matrix) {
                var copy = mat4.create();
                mat4.copy(copy, matrix);
                matrixStack.push(copy);
            };

            this.popMatrix = function() {
                if (matrixStack.length === 0) {
                    throw "Invalid popMatrix!";
                }
                return matrixStack.pop();
            };
            
            this.pushMvMatrix = function () {
                this.pushMatrix(this.mvMatrix);
            };
            
            this.popMvMatrix = function () {
                this.mvMatrix = this.popMatrix();
            };
            
            this.setMatrixUniforms = function () {
                this.gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, this.pMatrix);
                this.gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, this.mvMatrix);
            };
            
            this.perspective = function (fovy, aspect, near, far) {
                mat4.perspective(this.pMatrix, fovy, aspect, near, far);
            };
            
            this.identity = function() {
                mat4.identity(this.mvMatrix);
            };
            
            this.translate = function(x, y, z) {
                mat4.translate(this.mvMatrix, this.mvMatrix, [x, y, z]);
            };
            
            this.scale = function(x, y, z) {
                mat4.scale(this.mvMatrix, this.mvMatrix, [x, y, z]);
            };
            
            this.rotate = function(angle, vector) {
                mat4.rotate(this.mvMatrix, this.mvMatrix, angle, vector);
            };
            
            this.degToRad = function (degrees) {
                return degrees * Math.PI / 180;
            };
            
        };
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {
        
        this.Model = function(modelData, texturePath, color) {
            this.modelData = modelData;
            this.texturePath = texturePath || null;
            this.texture = null;
            this.color = color || new Float32Array([1, 1, 1, 1]); // white (empty) color
            this.graph = null;
            
            var positionBuffer = null;
            var textureCoordBuffer = null;
            var indexBuffer = null;
            var normalBuffer = null;
            
            this.init = function (graph) {
                this.graph = graph;
                initBuffers(graph, this.modelData);
                sokoban.util.TextureManager.addTexturedObject(this);
            };
            
            this.loadTexture = function (graph) {
                if (this.texturePath !== null) {
                    this.texture = sokoban.util.TextureManager.readTexture(graph, this.texturePath);
                } else {
                    this.texture = sokoban.util.TextureManager.loadEmptyTexture(graph);
                }
            };
            
            this.draw = function (graph) {
                var gl = graph.gl;
                
                graph.pushMvMatrix();
                
                this.underCell.draw(graph);
                this.animation.animate();
                
                graph.translate(this.animation.tx.current, this.animation.ty.current, this.animation.tz.current);
                graph.rotate(graph.degToRad(this.animation.rx.current), [1, 0, 0]);
                graph.rotate(graph.degToRad(this.animation.ry.current), [0, 1, 0]);
                graph.rotate(graph.degToRad(this.animation.rz.current), [0, 0, 1]);

                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.vertexPositionAttribute,
                        positionBuffer.itemSize, gl.FLOAT, false, 0, 0);
                        
                gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.textureCoordAttribute,
                        textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
                                
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.uniform1i(graph.shaderProgram.samplerUniform, 0);

                gl.uniform4fv(graph.shaderProgram.vertexColorUniform, this.color);
                gl.uniform1i(graph.shaderProgram.isLightNotUseUniform, 0);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                gl.vertexAttribPointer(graph.shaderProgram.vertexNormalAttribute,
                        normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
                
                gl.uniformMatrix3fv(graph.shaderProgram.nMatrixUniform, false, graph.getNormalMatrix());

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                graph.setMatrixUniforms();
                gl.drawElements(gl.TRIANGLES, indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);                
                
                graph.popMvMatrix();
            };
            
            function initBuffers(graph, modelData) {
                var gl = graph.gl;

                positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelData.verts), gl.STATIC_DRAW);
                positionBuffer.itemSize = 3;
                positionBuffer.numItems = modelData.verts.length / 3;

                textureCoordBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelData.texcoords), gl.STATIC_DRAW);
                textureCoordBuffer.itemSize = 2;
                textureCoordBuffer.numItems = modelData.texcoords.length / 2;

                indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(modelData.indices), gl.STATIC_DRAW);
                indexBuffer.itemSize = 1;
                indexBuffer.numItems = modelData.indices.length;
                
                normalBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelData.normals), gl.STATIC_DRAW);
                normalBuffer.itemSize = 3;
                normalBuffer.numItems = modelData.normals.length / 3;
            }
        };
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {
                
        this.ModelManager = (function() {
            
            var entry = function() {
            };
    
            entry.resourcePath = "";
            
            entry.loadData = function(path, loadedDataHandler) {
                var request = new XMLHttpRequest();
                request.open("GET", this.resourcePath + '/' + path);
                request.onreadystatechange = function() {
                    if (request.readyState === 4) {
                        loadedDataHandler(JSON.parse(request.responseText));
                    }
                };
                request.send();
            };
            
            return entry;
        })();
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var sokoban = (function() {
    this.util = (function() {
                
        this.TextureManager = (function() {
            var objects = [];
            var textures = {};
            var emptyTexture = null;
            var resourcePath = "";
            
            var entry = function() {
            };
    
            entry.readTexture = function(graph, path, textureLoadHandler) {
                if (typeof textureLoadHandler === 'undefined') {
                    textureLoadHandler = handleLoadedTexture;
                }
                
                var texture = null;
                if (path in textures) {
                    texture = textures[path];
                } else {
                    var image = new Image();

                    var texture = graph.gl.createTexture();
                    texture.image = image;

                    image.loaded = false;
                    image.onload = function() {
                        textureLoadHandler(graph, texture);
                        image.loaded = true;
                    };
                    image.src = (resourcePath ? resourcePath + '/' : '') + path;

                    textures[path] = texture;
                }
                
                return texture;
            };

            function handleLoadedTexture(graph, texture) {
                var gl = graph.gl;

                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.generateMipmap(gl.TEXTURE_2D);

                gl.bindTexture(gl.TEXTURE_2D, null);
            }
            
            entry.addTexturedObject = function (object) {
                objects.push(object);
            };
            
            entry.loadTextures = function (graph, resPath) {
                resourcePath = resPath;
                for (var i = 0; i < objects.length; ++i) {
                    objects[i].loadTexture(graph);
                }
            };
            
            entry.loadEmptyTexture = function (graph) {
                if (emptyTexture === null) {
                    var gl = graph.gl;
                    emptyTexture = gl.createTexture();

                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

                    gl.bindTexture(gl.TEXTURE_2D, emptyTexture);
                    var whitePixel = new Uint8Array([255, 255, 255, 255]);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, whitePixel);

                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
                return emptyTexture;
            };
            
            return entry;
        })();
    
        return this;
    }).call(this.util || {});
    return this;
}).call(sokoban || {});
var dokerModel = {"verts":[-0.089895,-0.23307,-0.369008,-0.058476,-0.400233,-0.369008,-0.342585,-0.400233,-0.162889,-0.312348,-0.169882,-0.205194,-0.266448,-0.204239,-0.205194,-0.390235,-0.350893,-0.162889,-0.156841,0.214013,0.002344,-0.086336,0.215079,0.002344,-0.086336,0.215584,-0.149691,0.086619,0.011979,-0.203612,0.084345,-0.015827,-0.369008,-0.043747,-0.121148,-0.369008,-0.089895,-0.23307,-0.149691,0.273657,-0.295892,-0.082901,-0.058476,-0.400233,-0.082901,0.254421,-0.015827,-0.082901,0.272187,-0.079498,-0.082901,-0.043747,-0.121148,-0.149691,-0.342987,-0.207129,-0.17563,-0.390235,-0.350893,-0.162889,-0.390235,-0.350893,-0.149691,0.210415,0.018324,-0.203612,-0.086336,0.125718,-0.196677,-0.086336,0.215584,-0.149691,-0.224514,-0.400233,-0.139447,-0.058476,-0.400233,-0.082901,-0.217018,-0.400233,-0.082901,-0.156841,0.214518,-0.149691,-0.378467,-0.128851,-0.149691,-0.378467,-0.129356,0.002344,-0.156841,0.214518,-0.149691,-0.156841,0.124652,-0.196677,-0.364116,-0.128851,-0.187971,-0.147756,-0.219161,-0.205194,-0.342585,-0.400233,-0.162889,-0.390235,-0.350893,-0.162889,-0.06552,-0.102089,-0.203612,-0.147756,-0.219161,-0.205194,-0.266448,-0.204239,-0.205194,-0.043747,-0.121148,-0.369008,-0.089895,-0.23307,-0.369008,-0.147756,-0.219161,-0.205194,-0.089895,-0.23307,-0.369008,-0.089895,-0.23307,-0.149691,-0.058476,-0.400233,-0.082901,-0.390235,-0.350893,-0.149691,-0.390235,-0.350893,-0.162889,-0.342585,-0.400233,-0.162889,-0.156841,0.124652,-0.196677,-0.156841,0.214518,-0.149691,-0.086336,0.215584,-0.149691,-0.21204,-0.16049,-0.205194,-0.226507,-0.119491,-0.205194,-0.11765,0.032925,-0.205194,-0.086336,0.125718,-0.196677,-0.11765,0.032925,-0.205194,-0.226507,-0.119491,-0.205194,-0.312348,-0.169882,-0.205194,-0.342987,-0.207129,-0.17563,-0.386471,-0.184513,-0.17563,-0.156841,0.124652,-0.196677,-0.226507,-0.119491,-0.205194,-0.312348,-0.169882,-0.205194,-0.21204,-0.16049,-0.205194,-0.266448,-0.204239,-0.205194,-0.312348,-0.169882,-0.205194,0.086619,0.011979,-0.203612,-0.06552,-0.102089,-0.203612,-0.21204,-0.16049,-0.205194,0.210415,0.018324,-0.203612,0.086619,0.011979,-0.203612,-0.11765,0.032925,-0.205194,0.210415,0.018324,-0.203612,0.211253,-0.003797,-0.369008,0.084345,-0.015827,-0.369008,-0.043747,-0.121148,-0.149691,-0.089895,-0.23307,-0.149691,-0.089895,-0.23307,-0.369008,0.272187,-0.079498,-0.082901,0.273657,-0.295892,-0.082901,-0.089895,-0.23307,-0.149691,0.084345,-0.015827,-0.369008,0.084345,-0.015827,-0.149691,-0.043747,-0.121148,-0.149691,0.211253,-0.003797,-0.369008,0.211253,-0.003797,-0.149691,0.084345,-0.015827,-0.149691,0.246264,-0.003797,-0.082901,0.254421,-0.015827,-0.082901,0.084345,-0.015827,-0.149691,0.210415,0.018324,-0.149691,-0.086336,0.215584,-0.149691,-0.086336,0.215079,0.002344,0.246264,-0.003797,-0.082901,0.211253,-0.003797,-0.149691,0.210415,0.018324,-0.149691,0.211253,-0.003797,-0.369008,0.210415,0.018324,-0.203612,0.210415,0.018324,-0.149691,-0.217018,-0.400233,-0.082901,-0.226949,-0.253505,0.002344,-0.222855,-0.256642,-0.139447,-0.342585,-0.400233,-0.149691,-0.342585,-0.400233,-0.162889,0.254421,-0.015827,-0.082901,0.254421,-0.016332,0.002344,0.272187,-0.080003,0.002235,0.272187,-0.079498,-0.082901,0.272187,-0.080003,0.002235,0.273657,-0.296397,0.002235,-0.217018,-0.400233,-0.082901,-0.221733,-0.320603,-0.139447,-0.224514,-0.400233,-0.139447,0.210415,0.018324,-0.082901,0.210415,0.017819,0.002344,0.246264,-0.004302,0.002344,-0.226949,-0.253505,0.002344,-0.217018,-0.400233,-0.082901,-0.217018,-0.400738,0.002344,0.246264,-0.003797,-0.082901,0.246264,-0.004302,0.002344,0.254421,-0.016332,0.002344,0.273657,-0.295892,-0.082901,0.273657,-0.296397,0.002235,-0.058476,-0.400738,0.002235,0.210415,0.018324,-0.082901,-0.086336,0.215079,0.002344,0.210415,0.017819,0.002344,-0.386471,-0.184513,-0.17563,-0.342987,-0.207129,-0.17563,-0.342987,-0.207129,-0.142783,-0.342987,-0.207129,-0.142783,-0.222855,-0.256642,-0.139447,-0.226949,-0.253505,0.002344,-0.378467,-0.129356,0.002344,-0.378467,-0.128851,-0.149691,-0.386471,-0.184513,-0.17563,-0.378467,-0.128851,-0.149691,-0.364116,-0.128851,-0.187971,-0.386471,-0.184513,-0.17563,-0.058476,-0.400233,-0.082901,-0.058476,-0.400738,0.002235,-0.217018,-0.400738,0.002344,-0.342585,-0.400233,0.167586,-0.058476,-0.400233,0.373704,-0.089895,-0.23307,0.373704,-0.312348,-0.169882,0.20989,-0.342987,-0.207129,0.180326,-0.390235,-0.350893,0.167586,-0.156841,0.214013,0.002352,-0.156841,0.214518,0.154388,-0.086336,0.215584,0.154388,0.086619,0.011979,0.208309,-0.06552,-0.102089,0.208309,-0.043747,-0.121148,0.373704,-0.089895,-0.23307,0.154388,-0.058476,-0.400233,0.087597,0.273657,-0.295892,0.087597,-0.043747,-0.121148,0.154388,0.272187,-0.079498,0.087597,0.254421,-0.015827,0.087597,-0.390235,-0.350893,0.154388,-0.390235,-0.350893,0.167586,-0.342987,-0.207129,0.180326,-0.086336,0.215584,0.154388,-0.086336,0.125718,0.201373,0.210415,0.018324,0.208309,-0.224514,-0.400233,0.144143,-0.217018,-0.400233,0.087597,-0.058476,-0.400233,0.087597,-0.378467,-0.129356,0.002352,-0.378467,-0.128851,0.154388,-0.156841,0.214518,0.154388,-0.156841,0.214518,0.154388,-0.378467,-0.128851,0.154388,-0.364116,-0.128851,0.192667,-0.390235,-0.350893,0.167586,-0.342585,-0.400233,0.167586,-0.147756,-0.219161,0.20989,-0.266448,-0.204239,0.20989,-0.147756,-0.219161,0.20989,-0.06552,-0.102089,0.208309,-0.147756,-0.219161,0.20989,-0.089895,-0.23307,0.373704,-0.043747,-0.121148,0.373704,-0.089895,-0.23307,0.373704,-0.058476,-0.400233,0.373704,-0.058476,-0.400233,0.087597,-0.342585,-0.400233,0.154388,-0.342585,-0.400233,0.167586,-0.390235,-0.350893,0.167586,-0.156841,0.124652,0.201373,-0.086336,0.125718,0.201373,-0.086336,0.215584,0.154388,-0.21204,-0.16049,0.20989,-0.11765,0.032925,0.20989,-0.226507,-0.119491,0.20989,-0.086336,0.125718,0.201373,-0.156841,0.124652,0.201373,-0.226507,-0.119491,0.20989,-0.386471,-0.184513,0.180326,-0.342987,-0.207129,0.180326,-0.312348,-0.169882,0.20989,-0.156841,0.124652,0.201373,-0.364116,-0.128851,0.192667,-0.312348,-0.169882,0.20989,-0.312348,-0.169882,0.20989,-0.266448,-0.204239,0.20989,-0.21204,-0.16049,0.20989,-0.06552,-0.102089,0.208309,0.086619,0.011979,0.208309,-0.11765,0.032925,0.20989,0.086619,0.011979,0.208309,0.210415,0.018324,0.208309,0.210415,0.018324,0.208309,0.086619,0.011979,0.208309,0.084345,-0.015827,0.373704,-0.043747,-0.121148,0.373704,-0.089895,-0.23307,0.373704,-0.089895,-0.23307,0.154388,-0.089895,-0.23307,0.154388,0.273657,-0.295892,0.087597,0.272187,-0.079498,0.087597,-0.043747,-0.121148,0.373704,-0.043747,-0.121148,0.154388,0.084345,-0.015827,0.154388,0.084345,-0.015827,0.373704,0.084345,-0.015827,0.154388,0.211253,-0.003797,0.154388,0.084345,-0.015827,0.154388,0.254421,-0.015827,0.087597,0.246264,-0.003797,0.087597,-0.086336,0.215079,0.002352,-0.086336,0.215584,0.154388,0.210415,0.018324,0.154388,0.246264,-0.003797,0.087597,0.210415,0.018324,0.087597,0.210415,0.018324,0.154388,0.210415,0.018324,0.154388,0.210415,0.018324,0.208309,0.211253,-0.003797,0.373704,-0.217018,-0.400233,0.087597,-0.221733,-0.320603,0.144143,-0.222855,-0.256642,0.144143,-0.058476,-0.400233,0.373704,0.272187,-0.080003,0.002461,0.254421,-0.016332,0.002352,0.254421,-0.015827,0.087597,0.273657,-0.296397,0.002461,0.272187,-0.080003,0.002461,0.272187,-0.079498,0.087597,-0.217018,-0.400233,0.087597,-0.224514,-0.400233,0.144143,-0.221733,-0.320603,0.144143,0.246264,-0.004302,0.002352,0.210415,0.017819,0.002352,0.210415,0.018324,0.087597,-0.226949,-0.253505,0.002352,-0.217018,-0.400738,0.002352,-0.217018,-0.400233,0.087597,0.254421,-0.016332,0.002352,0.246264,-0.004302,0.002352,0.246264,-0.003797,0.087597,-0.058476,-0.400738,0.002461,0.273657,-0.296397,0.002461,0.273657,-0.295892,0.087597,0.210415,0.018324,0.087597,0.210415,0.017819,0.002352,-0.086336,0.215079,0.002352,-0.386471,-0.184513,0.180326,-0.342987,-0.207129,0.147479,-0.342987,-0.207129,0.180326,-0.226949,-0.253505,0.002352,-0.222855,-0.256642,0.144143,-0.342987,-0.207129,0.147479,-0.378467,-0.129356,0.002352,-0.386471,-0.185018,0.002352,-0.386471,-0.184513,0.180326,-0.378467,-0.128851,0.154388,-0.386471,-0.184513,0.180326,-0.364116,-0.128851,0.192667,-0.217018,-0.400738,0.002352,-0.058476,-0.400738,0.002461,-0.058476,-0.400233,0.087597,-0.222855,-0.256642,-0.139447,-0.342987,-0.207129,-0.142783,-0.390235,-0.350893,-0.149691,-0.390235,-0.350893,-0.149691,-0.342585,-0.400233,-0.149691,-0.224514,-0.400233,-0.139447,-0.390235,-0.350893,0.154388,-0.342987,-0.207129,0.147479,-0.222855,-0.256642,0.144143,-0.224514,-0.400233,0.144143,-0.342585,-0.400233,0.154388,-0.390235,-0.350893,0.154388,-0.147756,-0.219161,-0.205194,-0.089895,-0.23307,-0.369008,-0.342585,-0.400233,-0.162889,-0.342987,-0.207129,-0.17563,-0.312348,-0.169882,-0.205194,-0.390235,-0.350893,-0.162889,-0.156841,0.214518,-0.149691,-0.156841,0.214013,0.002344,-0.086336,0.215584,-0.149691,-0.06552,-0.102089,-0.203612,0.086619,0.011979,-0.203612,-0.043747,-0.121148,-0.369008,0.084345,-0.015827,-0.149691,0.254421,-0.015827,-0.082901,-0.043747,-0.121148,-0.149691,-0.342987,-0.207129,-0.142783,-0.342987,-0.207129,-0.17563,-0.390235,-0.350893,-0.149691,0.210415,0.018324,-0.149691,0.210415,0.018324,-0.203612,-0.086336,0.215584,-0.149691,-0.156841,0.214013,0.002344,-0.378467,-0.128851,-0.149691,-0.156841,0.214518,-0.149691,-0.364116,-0.128851,-0.187971,-0.266448,-0.204239,-0.205194,-0.147756,-0.219161,-0.205194,-0.390235,-0.350893,-0.162889,-0.21204,-0.16049,-0.205194,-0.06552,-0.102089,-0.203612,-0.266448,-0.204239,-0.205194,-0.06552,-0.102089,-0.203612,-0.043747,-0.121148,-0.369008,-0.147756,-0.219161,-0.205194,-0.058476,-0.400233,-0.369008,-0.342585,-0.400233,-0.149691,-0.086336,0.125718,-0.196677,-0.156841,0.124652,-0.196677,-0.086336,0.125718,-0.196677,-0.226507,-0.119491,-0.205194,-0.364116,-0.128851,-0.187971,-0.312348,-0.169882,-0.205194,-0.386471,-0.184513,-0.17563,-0.364116,-0.128851,-0.187971,-0.156841,0.124652,-0.196677,-0.312348,-0.169882,-0.205194,-0.226507,-0.119491,-0.205194,-0.11765,0.032925,-0.205194,0.086619,0.011979,-0.203612,-0.21204,-0.16049,-0.205194,-0.086336,0.125718,-0.196677,0.210415,0.018324,-0.203612,-0.11765,0.032925,-0.205194,0.086619,0.011979,-0.203612,0.210415,0.018324,-0.203612,0.084345,-0.015827,-0.369008,-0.043747,-0.121148,-0.369008,-0.043747,-0.121148,-0.149691,0.272187,-0.079498,-0.082901,-0.089895,-0.23307,-0.149691,-0.043747,-0.121148,-0.369008,0.084345,-0.015827,-0.369008,0.211253,-0.003797,-0.149691,0.246264,-0.003797,-0.082901,0.084345,-0.015827,-0.149691,0.210415,0.018324,-0.082901,0.210415,0.018324,-0.149691,-0.086336,0.215079,0.002344,0.210415,0.018324,-0.082901,0.246264,-0.003797,-0.082901,0.210415,0.018324,-0.149691,0.211253,-0.003797,-0.149691,0.211253,-0.003797,-0.369008,0.210415,0.018324,-0.149691,-0.221733,-0.320603,-0.139447,-0.217018,-0.400233,-0.082901,-0.222855,-0.256642,-0.139447,-0.058476,-0.400233,-0.369008,0.272187,-0.079498,-0.082901,0.254421,-0.015827,-0.082901,0.272187,-0.080003,0.002235,0.273657,-0.295892,-0.082901,0.272187,-0.079498,-0.082901,0.273657,-0.296397,0.002235,0.246264,-0.003797,-0.082901,0.210415,0.018324,-0.082901,0.246264,-0.004302,0.002344,0.254421,-0.015827,-0.082901,0.246264,-0.003797,-0.082901,0.254421,-0.016332,0.002344,-0.058476,-0.400233,-0.082901,-0.386471,-0.184513,-0.17563,-0.342987,-0.207129,-0.142783,-0.386471,-0.185018,0.002344,-0.386471,-0.185018,0.002344,-0.378467,-0.129356,0.002344,-0.386471,-0.184513,-0.17563,-0.217018,-0.400233,-0.082901,-0.058476,-0.400233,-0.082901,-0.217018,-0.400738,0.002344,-0.342987,-0.207129,-0.142783,-0.226949,-0.253505,0.002344,-0.386471,-0.185018,0.002344,-0.147756,-0.219161,0.20989,-0.342585,-0.400233,0.167586,-0.089895,-0.23307,0.373704,-0.266448,-0.204239,0.20989,-0.312348,-0.169882,0.20989,-0.390235,-0.350893,0.167586,-0.086336,0.215079,0.002352,-0.156841,0.214013,0.002352,-0.086336,0.215584,0.154388,0.084345,-0.015827,0.373704,0.086619,0.011979,0.208309,-0.043747,-0.121148,0.373704,0.084345,-0.015827,0.154388,-0.043747,-0.121148,0.154388,0.254421,-0.015827,0.087597,-0.342987,-0.207129,0.147479,-0.390235,-0.350893,0.154388,-0.342987,-0.207129,0.180326,0.210415,0.018324,0.154388,-0.086336,0.215584,0.154388,0.210415,0.018324,0.208309,-0.156841,0.214013,0.002352,-0.156841,0.124652,0.201373,-0.156841,0.214518,0.154388,-0.364116,-0.128851,0.192667,-0.266448,-0.204239,0.20989,-0.390235,-0.350893,0.167586,-0.147756,-0.219161,0.20989,-0.21204,-0.16049,0.20989,-0.266448,-0.204239,0.20989,-0.06552,-0.102089,0.208309,-0.06552,-0.102089,0.208309,-0.147756,-0.219161,0.20989,-0.043747,-0.121148,0.373704,-0.089895,-0.23307,0.154388,-0.390235,-0.350893,0.154388,-0.342585,-0.400233,0.154388,-0.390235,-0.350893,0.167586,-0.156841,0.214518,0.154388,-0.11765,0.032925,0.20989,-0.086336,0.125718,0.201373,-0.226507,-0.119491,0.20989,-0.364116,-0.128851,0.192667,-0.386471,-0.184513,0.180326,-0.312348,-0.169882,0.20989,-0.226507,-0.119491,0.20989,-0.156841,0.124652,0.201373,-0.312348,-0.169882,0.20989,-0.11765,0.032925,0.20989,-0.21204,-0.16049,0.20989,0.086619,0.011979,0.208309,-0.086336,0.125718,0.201373,-0.11765,0.032925,0.20989,0.210415,0.018324,0.208309,0.211253,-0.003797,0.373704,0.210415,0.018324,0.208309,0.084345,-0.015827,0.373704,-0.043747,-0.121148,0.154388,-0.043747,-0.121148,0.154388,-0.089895,-0.23307,0.154388,0.272187,-0.079498,0.087597,0.084345,-0.015827,0.373704,0.211253,-0.003797,0.373704,0.211253,-0.003797,0.154388,0.084345,-0.015827,0.154388,0.246264,-0.003797,0.087597,0.210415,0.018324,0.087597,-0.086336,0.215079,0.002352,0.210415,0.018324,0.154388,0.211253,-0.003797,0.154388,0.246264,-0.003797,0.087597,0.210415,0.018324,0.154388,0.211253,-0.003797,0.154388,0.210415,0.018324,0.154388,0.211253,-0.003797,0.373704,-0.226949,-0.253505,0.002352,-0.217018,-0.400233,0.087597,-0.222855,-0.256642,0.144143,-0.342585,-0.400233,0.154388,-0.342585,-0.400233,0.167586,0.272187,-0.079498,0.087597,0.272187,-0.080003,0.002461,0.254421,-0.015827,0.087597,0.273657,-0.295892,0.087597,0.273657,-0.296397,0.002461,0.272187,-0.079498,0.087597,0.246264,-0.003797,0.087597,0.246264,-0.004302,0.002352,0.210415,0.018324,0.087597,0.254421,-0.015827,0.087597,0.254421,-0.016332,0.002352,0.246264,-0.003797,0.087597,-0.058476,-0.400233,0.087597,-0.226949,-0.253505,0.002352,-0.342987,-0.207129,0.147479,-0.386471,-0.185018,0.002352,-0.378467,-0.128851,0.154388,-0.378467,-0.129356,0.002352,-0.386471,-0.184513,0.180326,-0.217018,-0.400233,0.087597,-0.217018,-0.400738,0.002352,-0.058476,-0.400233,0.087597,-0.342987,-0.207129,0.147479,-0.386471,-0.184513,0.180326,-0.386471,-0.185018,0.002352,-0.221733,-0.320603,-0.139447,-0.222855,-0.256642,-0.139447,-0.390235,-0.350893,-0.149691,-0.221733,-0.320603,-0.139447,-0.390235,-0.350893,-0.149691,-0.224514,-0.400233,-0.139447,-0.221733,-0.320603,0.144143,-0.390235,-0.350893,0.154388,-0.222855,-0.256642,0.144143,-0.221733,-0.320603,0.144143,-0.224514,-0.400233,0.144143,-0.390235,-0.350893,0.154388,0.457386,0.035627,0.21133,0.457386,0.026,0.181642,0.457386,-0.02412,0.21133,0.457386,-0.02412,0.21133,0.491833,-0.02412,0.21133,0.491833,0.035627,0.21133,0.491833,-0.043375,0.151954,0.491833,-0.043375,-0.130384,0.491833,0.016372,-0.130384,0.491833,-0.043375,-0.130384,0.457386,-0.043375,-0.130384,0.457386,0.016372,-0.130384,0.491833,-0.043375,0.151954,0.491833,-0.02412,0.21133,0.457386,-0.02412,0.21133,0.457386,-0.043375,-0.130384,0.457386,-0.043375,0.151954,0.457386,0.016372,0.151954,0.491833,0.035627,0.21133,0.491833,-0.02412,0.21133,0.491833,-0.043375,-0.130384,0.491833,-0.043375,0.151954,0.457386,-0.043375,0.151954,0.457386,0.016372,-0.130384,0.457386,0.016372,0.151954,0.491833,0.016372,0.151954,0.457386,0.132462,0.181642,0.457386,0.120741,0.21133,0.457386,0.180488,0.21133,0.457386,0.120741,0.21133,0.491833,0.120741,0.21133,0.491833,0.180488,0.21133,0.491833,0.144183,0.151954,0.491833,0.144183,-0.130384,0.491833,0.20393,-0.130384,0.491833,0.144183,-0.130384,0.457386,0.144183,-0.130384,0.457386,0.20393,-0.130384,0.457386,0.20393,0.151954,0.457386,0.180488,0.21133,0.491833,0.180488,0.21133,0.457386,0.144183,-0.130384,0.457386,0.144183,0.151954,0.457386,0.20393,0.151954,0.491833,0.120741,0.21133,0.491833,0.20393,0.151954,0.491833,0.144183,-0.130384,0.491833,0.144183,0.151954,0.457386,0.144183,0.151954,0.457386,0.20393,-0.130384,0.457386,0.20393,0.151954,0.491833,0.20393,0.151954,0.457386,0.016372,0.151954,0.457386,0.144183,0.151954,0.491833,0.144183,0.151954,0.436913,0.120249,0.21133,0.457386,0.120741,0.21133,0.457386,0.132462,0.181642,0.491833,0.016372,0.151954,0.48253,0.102385,0.243169,0.48253,0.058064,0.243169,0.491833,0.035627,0.21133,0.457386,0.035627,0.243169,0.48253,0.058064,0.243169,0.48253,0.102385,0.243169,-0.247712,0.205817,0.21133,-0.247712,0.205817,0.243169,-0.12665,0.262647,0.243169,0.457386,0.120741,0.243169,0.48253,0.102385,0.243169,0.491833,0.120741,0.21133,0.491833,0.035627,0.21133,0.48253,0.058064,0.243169,0.457386,0.035627,0.243169,-0.239447,0.127479,0.243169,-0.247712,0.205817,0.243169,-0.247712,0.205817,0.21133,-0.239447,0.127479,0.243169,-0.239447,0.127479,0.21133,-0.175497,0.082734,0.21133,-0.247712,0.205817,0.243169,-0.239447,0.127479,0.243169,-0.175497,0.082734,0.243169,-0.175497,0.082734,0.21133,-0.239447,0.127479,0.21133,-0.247712,0.205817,0.21133,0.436913,0.120249,0.21133,0.436913,0.120249,0.243169,0.457386,0.120741,0.243169,0.436455,0.035136,0.243169,0.436455,0.035136,0.21133,0.457386,0.035627,0.21133,0.457386,0.120741,0.243169,0.436913,0.120249,0.243169,0.436455,0.035136,0.243169,0.457386,0.035627,0.21133,0.436455,0.035136,0.21133,0.457386,0.026,0.181642,0.163716,0.205733,0.21133,0.163716,0.205733,0.243169,0.436913,0.120249,0.243169,0.138097,0.124566,0.243169,0.138097,0.124566,0.21133,0.436455,0.035136,0.21133,0.163716,0.205733,0.243169,0.138097,0.124566,0.243169,0.436455,0.035136,0.243169,0.436455,0.035136,0.21133,0.138097,0.124566,0.21133,0.163716,0.205733,0.21133,-0.12665,0.262647,0.21133,-0.12665,0.262647,0.243169,0.163716,0.205733,0.243169,0.138097,0.124566,0.243169,-0.175497,0.082734,0.243169,-0.175497,0.082734,0.21133,-0.12665,0.262647,0.243169,-0.175497,0.082734,0.21133,-0.12665,0.262647,0.21133,0.436455,0.035136,0.21133,0.436913,0.120249,0.21133,0.457386,0.132462,0.181642,0.457386,0.035627,0.21133,0.491833,0.016372,-0.130384,0.457386,-0.043375,0.151954,0.457386,0.016372,-0.130384,0.457386,-0.043375,-0.130384,0.491833,0.016372,-0.130384,0.457386,0.180488,0.21133,0.491833,0.20393,-0.130384,0.491833,0.20393,0.151954,0.457386,0.20393,-0.130384,0.491833,0.180488,0.21133,0.457386,0.144183,-0.130384,0.491833,0.20393,-0.130384,0.491833,0.016372,0.151954,0.491833,0.120741,0.21133,0.48253,0.102385,0.243169,0.491833,0.035627,0.21133,0.457386,0.120741,0.243169,0.457386,0.035627,0.243169,0.48253,0.102385,0.243169,-0.12665,0.262647,0.21133,-0.247712,0.205817,0.21133,-0.12665,0.262647,0.243169,0.457386,0.120741,0.21133,0.457386,0.120741,0.243169,0.491833,0.120741,0.21133,0.457386,0.035627,0.21133,0.491833,0.035627,0.21133,0.457386,0.035627,0.243169,-0.239447,0.127479,0.21133,-0.175497,0.082734,0.243169,-0.239447,0.127479,0.243169,-0.175497,0.082734,0.21133,-0.247712,0.205817,0.21133,0.457386,0.120741,0.21133,0.457386,0.035627,0.243169,0.436913,0.120249,0.21133,0.163716,0.205733,0.21133,0.436913,0.120249,0.243169,0.436455,0.035136,0.243169,0.138097,0.124566,0.243169,0.436455,0.035136,0.21133,0.436913,0.120249,0.243169,0.436913,0.120249,0.21133,0.163716,0.205733,0.21133,0.138097,0.124566,0.21133,0.457386,0.026,0.181642,0.436455,0.035136,0.21133,0.457386,0.132462,0.181642,0.082729,-0.04933,0.15433,0.125278,-0.036423,0.15433,0.256324,-0.468424,0.15433,0.317485,-0.288308,0.268301,0.320384,-0.258877,0.268301,0.140096,-0.110919,0.268301,0.169527,-0.032065,0.335192,0.125278,-0.036423,0.335192,0.13938,-0.10732,0.33838,0.125278,-0.036423,0.335192,0.08273,-0.04933,0.335192,0.110392,-0.116113,0.33838,0.08273,-0.04933,0.335192,0.043517,-0.07029,0.335193,0.083677,-0.130393,0.33838,0.043517,-0.07029,0.335193,0.009147,-0.098497,0.335193,0.06026,-0.14961,0.33838,0.06026,-0.14961,0.33838,0.009147,-0.098497,0.335193,-0.01906,-0.132867,0.335193,0.041043,-0.173027,0.33838,-0.01906,-0.132867,0.335193,-0.04002,-0.17208,0.335193,0.026763,-0.199742,0.33838,-0.04002,-0.17208,0.335193,-0.052927,-0.214628,0.335193,0.01797,-0.22873,0.33838,-0.052927,-0.214628,0.335193,-0.057285,-0.258877,0.335193,0.015,-0.258877,0.33838,-0.057285,-0.258877,0.335193,-0.052927,-0.303126,0.335193,0.01797,-0.289023,0.33838,-0.052927,-0.303126,0.335193,-0.04002,-0.345674,0.335193,-0.04002,-0.345674,0.335193,-0.01906,-0.384887,0.335193,0.041043,-0.344727,0.33838,-0.01906,-0.384887,0.335193,0.009147,-0.419257,0.335193,0.06026,-0.368143,0.33838,0.06026,-0.368143,0.33838,0.009147,-0.419257,0.335193,0.043517,-0.447464,0.335193,0.043517,-0.447464,0.335193,0.08273,-0.468424,0.335193,0.110392,-0.401641,0.33838,0.08273,-0.468424,0.335193,0.125278,-0.481331,0.335193,0.13938,-0.410434,0.33838,0.125278,-0.481331,0.335193,0.169527,-0.485689,0.335193,0.169527,-0.413403,0.33838,0.169527,-0.413403,0.33838,0.169527,-0.485689,0.335193,0.213776,-0.481331,0.335193,0.213776,-0.481331,0.335193,0.256324,-0.468424,0.335192,0.228662,-0.401641,0.33838,0.228662,-0.401641,0.33838,0.256324,-0.468424,0.335192,0.295537,-0.447464,0.335192,0.295537,-0.447464,0.335192,0.329907,-0.419257,0.335192,0.278793,-0.368143,0.33838,0.329907,-0.419257,0.335192,0.358114,-0.384887,0.335192,0.298011,-0.344727,0.338379,0.298011,-0.344727,0.338379,0.358114,-0.384887,0.335192,0.379074,-0.345674,0.335192,0.379074,-0.345674,0.335192,0.39198,-0.303126,0.335192,0.321084,-0.289023,0.338379,0.321084,-0.289023,0.338379,0.39198,-0.303126,0.335192,0.396338,-0.258877,0.335192,0.324053,-0.258877,0.338379,0.396338,-0.258877,0.335192,0.39198,-0.214628,0.335192,0.39198,-0.214628,0.335192,0.379073,-0.17208,0.335192,0.31229,-0.199742,0.338379,0.379073,-0.17208,0.335192,0.358114,-0.132867,0.335192,0.298011,-0.173027,0.338379,0.358114,-0.132867,0.335192,0.329907,-0.098497,0.335192,0.278793,-0.14961,0.338379,0.329907,-0.098497,0.335192,0.295536,-0.07029,0.335192,0.255377,-0.130393,0.338379,0.295536,-0.07029,0.335192,0.256324,-0.04933,0.335192,0.228661,-0.116113,0.338379,0.199673,-0.10732,0.338379,0.213775,-0.036423,0.335192,0.169527,-0.032065,0.335192,0.256324,-0.04933,0.335192,0.213775,-0.036423,0.335192,0.199673,-0.10732,0.338379,0.169527,-0.10802,0.268301,0.169527,-0.104351,0.33838,0.13938,-0.10732,0.33838,0.140096,-0.110919,0.268301,0.13938,-0.10732,0.33838,0.110392,-0.116113,0.33838,0.111796,-0.119503,0.268301,0.110392,-0.116113,0.33838,0.083677,-0.130393,0.33838,0.085715,-0.133444,0.268301,0.083677,-0.130393,0.33838,0.06026,-0.14961,0.33838,0.062855,-0.152205,0.268301,0.06026,-0.14961,0.33838,0.041043,-0.173027,0.33838,0.044094,-0.175065,0.268301,0.041043,-0.173027,0.33838,0.026763,-0.199742,0.33838,0.030153,-0.201146,0.268302,0.026763,-0.199742,0.33838,0.01797,-0.22873,0.33838,0.021568,-0.229446,0.268302,0.01797,-0.22873,0.33838,0.015,-0.258877,0.33838,0.01867,-0.258877,0.268302,0.015,-0.258877,0.33838,0.01797,-0.289023,0.33838,0.021568,-0.288308,0.268302,0.01797,-0.289023,0.33838,0.026763,-0.318012,0.33838,0.026763,-0.318012,0.33838,0.041043,-0.344727,0.33838,0.044094,-0.342689,0.268302,0.044094,-0.342689,0.268302,0.041043,-0.344727,0.33838,0.06026,-0.368143,0.33838,0.062855,-0.365549,0.268302,0.06026,-0.368143,0.33838,0.083677,-0.387361,0.33838,0.085715,-0.38431,0.268302,0.083677,-0.387361,0.33838,0.110392,-0.401641,0.33838,0.111796,-0.398251,0.268302,0.110392,-0.401641,0.33838,0.13938,-0.410434,0.33838,0.13938,-0.410434,0.33838,0.169527,-0.413403,0.33838,0.169527,-0.409734,0.268301,0.169527,-0.409734,0.268301,0.169527,-0.413403,0.33838,0.199673,-0.410434,0.33838,0.199673,-0.410434,0.33838,0.228662,-0.401641,0.33838,0.227257,-0.398251,0.268301,0.228662,-0.401641,0.33838,0.255377,-0.387361,0.33838,0.253338,-0.38431,0.268301,0.253338,-0.38431,0.268301,0.255377,-0.387361,0.33838,0.278793,-0.368143,0.33838,0.278793,-0.368143,0.33838,0.298011,-0.344727,0.338379,0.29496,-0.342689,0.268301,0.298011,-0.344727,0.338379,0.312291,-0.318011,0.338379,0.3089,-0.316607,0.268301,0.312291,-0.318011,0.338379,0.321084,-0.289023,0.338379,0.317485,-0.288308,0.268301,0.321084,-0.289023,0.338379,0.324053,-0.258877,0.338379,0.320384,-0.258877,0.268301,0.324053,-0.258877,0.338379,0.321084,-0.22873,0.338379,0.317485,-0.229446,0.268301,0.321084,-0.22873,0.338379,0.31229,-0.199742,0.338379,0.3089,-0.201146,0.268301,0.3089,-0.201146,0.268301,0.31229,-0.199742,0.338379,0.298011,-0.173027,0.338379,0.298011,-0.173027,0.338379,0.278793,-0.14961,0.338379,0.276199,-0.152205,0.268301,0.278793,-0.14961,0.338379,0.255377,-0.130393,0.338379,0.253338,-0.133444,0.268301,0.255377,-0.130393,0.338379,0.228661,-0.116113,0.338379,0.227257,-0.119503,0.268301,0.198957,-0.110918,0.268301,0.199673,-0.10732,0.338379,0.169527,-0.104351,0.33838,0.228661,-0.116113,0.338379,0.199673,-0.10732,0.338379,0.198957,-0.110918,0.268301,0.169527,-0.032065,0.15433,0.213775,-0.036423,0.15433,0.125278,-0.036423,0.15433,0.39198,-0.303126,0.15433,0.379073,-0.345674,0.15433,0.256323,-0.04933,0.15433,0.295536,-0.07029,0.15433,0.329906,-0.098497,0.15433,0.329906,-0.098497,0.15433,0.358113,-0.132867,0.15433,0.379073,-0.17208,0.15433,0.379073,-0.17208,0.15433,0.39198,-0.214628,0.15433,0.396338,-0.258877,0.15433,-0.04002,-0.345674,0.15433,-0.057285,-0.258877,0.15433,-0.052927,-0.214628,0.15433,0.379073,-0.345674,0.15433,0.358114,-0.384887,0.15433,0.329907,-0.419257,0.15433,0.329907,-0.419257,0.15433,0.295536,-0.447464,0.15433,0.256324,-0.468424,0.15433,0.256324,-0.468424,0.15433,0.213775,-0.481331,0.15433,0.169527,-0.485689,0.15433,0.082729,-0.468424,0.15433,0.043517,-0.447464,0.15433,0.125278,-0.481331,0.15433,-0.019061,-0.384887,0.15433,-0.04002,-0.345674,0.15433,0.125278,-0.481331,0.15433,-0.04002,-0.345674,0.15433,-0.052927,-0.303126,0.15433,-0.057285,-0.258877,0.15433,-0.04002,-0.17208,0.15433,-0.04002,-0.17208,0.15433,-0.019061,-0.132867,0.15433,0.009146,-0.098497,0.15433,0.009146,-0.098497,0.15433,0.043517,-0.07029,0.15433,0.379073,-0.17208,0.15433,0.125278,-0.036423,0.15433,0.256323,-0.04933,0.15433,0.256323,-0.04933,0.15433,0.329906,-0.098497,0.15433,0.379073,-0.17208,0.15433,-0.04002,-0.345674,0.15433,0.169527,-0.485689,0.15433,0.125278,-0.481331,0.15433,0.379073,-0.345674,0.15433,0.329907,-0.419257,0.15433,0.256324,-0.468424,0.15433,0.043517,-0.447464,0.15433,0.009146,-0.419257,0.15433,-0.019061,-0.384887,0.15433,0.043517,-0.447464,0.15433,-0.019061,-0.384887,0.15433,0.125278,-0.481331,0.15433,0.379073,-0.17208,0.15433,-0.04002,-0.17208,0.15433,0.009146,-0.098497,0.15433,0.082729,-0.04933,0.15433,0.213775,-0.036423,0.15433,0.39198,-0.303126,0.15433,0.169527,-0.485689,0.15433,0.082729,-0.04933,0.15433,-0.04002,-0.345674,0.15433,-0.04002,-0.17208,0.15433,0.379073,-0.17208,0.15433,0.396338,-0.258877,0.15433,0.39198,-0.303126,0.15433,0.140096,-0.110919,0.268301,0.29496,-0.175065,0.268301,0.169527,-0.10802,0.268301,0.140096,-0.110919,0.268301,0.111796,-0.119503,0.268301,0.085715,-0.133444,0.268301,0.111796,-0.398251,0.268302,0.140096,-0.406835,0.268301,0.169527,-0.409734,0.268301,0.021568,-0.229446,0.268302,0.062855,-0.152205,0.268301,0.030153,-0.201146,0.268302,0.021568,-0.288308,0.268302,0.030153,-0.316607,0.268302,0.01867,-0.258877,0.268302,0.276199,-0.365549,0.268301,0.29496,-0.342689,0.268301,0.3089,-0.316607,0.268301,0.085715,-0.38431,0.268302,0.111796,-0.398251,0.268302,0.062855,-0.365549,0.268302,0.320384,-0.258877,0.268301,0.317485,-0.229446,0.268301,0.3089,-0.201146,0.268301,0.198957,-0.406835,0.268301,0.111796,-0.398251,0.268302,0.169527,-0.409734,0.268301,0.198957,-0.406835,0.268301,0.227257,-0.398251,0.268301,0.253338,-0.38431,0.268301,0.062855,-0.152205,0.268301,0.044094,-0.175065,0.268301,0.030153,-0.201146,0.268302,0.317485,-0.288308,0.268301,0.276199,-0.365549,0.268301,0.3089,-0.316607,0.268301,0.030153,-0.316607,0.268302,0.01867,-0.258877,0.268302,0.29496,-0.175065,0.268301,0.320384,-0.258877,0.268301,0.3089,-0.201146,0.268301,0.29496,-0.175065,0.268301,0.276199,-0.152205,0.268301,0.253338,-0.133444,0.268301,0.198957,-0.110918,0.268301,0.169527,-0.10802,0.268301,0.227257,-0.119503,0.268301,0.085715,-0.133444,0.268301,0.062855,-0.152205,0.268301,0.140096,-0.110919,0.268301,0.062855,-0.152205,0.268301,0.021568,-0.229446,0.268302,0.140096,-0.110919,0.268301,0.030153,-0.316607,0.268302,0.044094,-0.342689,0.268302,0.317485,-0.288308,0.268301,0.169527,-0.104351,0.33838,0.169527,-0.032065,0.335192,0.13938,-0.10732,0.33838,0.253338,-0.38431,0.268301,0.276199,-0.365549,0.268301,0.198957,-0.406835,0.268301,0.276199,-0.365549,0.268301,0.198957,-0.406835,0.268301,0.320384,-0.258877,0.268301,0.29496,-0.175065,0.268301,0.140096,-0.110919,0.268301,0.227257,-0.119503,0.268301,0.169527,-0.10802,0.268301,0.111796,-0.398251,0.268302,0.044094,-0.342689,0.268302,0.062855,-0.365549,0.268302,0.198957,-0.406835,0.268301,0.317485,-0.288308,0.268301,0.111796,-0.398251,0.268302,0.253338,-0.133444,0.268301,0.227257,-0.119503,0.268301,0.29496,-0.175065,0.268301,0.317485,-0.288308,0.268301,0.044094,-0.342689,0.268302,0.111796,-0.398251,0.268302,0.13938,-0.10732,0.33838,0.125278,-0.036423,0.335192,0.110392,-0.116113,0.33838,0.021568,-0.229446,0.268302,0.030153,-0.316607,0.268302,0.110392,-0.116113,0.33838,0.08273,-0.04933,0.335192,0.083677,-0.130393,0.33838,0.083677,-0.130393,0.33838,0.043517,-0.07029,0.335193,0.06026,-0.14961,0.33838,0.041043,-0.173027,0.33838,0.026763,-0.199742,0.33838,0.01797,-0.22873,0.33838,0.015,-0.258877,0.33838,0.01797,-0.22873,0.33838,-0.057285,-0.258877,0.335193,0.01797,-0.289023,0.33838,0.015,-0.258877,0.33838,-0.052927,-0.303126,0.335193,0.026763,-0.318012,0.33838,0.01797,-0.289023,0.33838,-0.04002,-0.345674,0.335193,0.026763,-0.318012,0.33838,-0.04002,-0.345674,0.335193,0.041043,-0.344727,0.33838,0.041043,-0.344727,0.33838,-0.01906,-0.384887,0.335193,0.06026,-0.368143,0.33838,0.083677,-0.387361,0.33838,0.06026,-0.368143,0.33838,0.043517,-0.447464,0.335193,0.083677,-0.387361,0.33838,0.043517,-0.447464,0.335193,0.110392,-0.401641,0.33838,0.110392,-0.401641,0.33838,0.08273,-0.468424,0.335193,0.13938,-0.410434,0.33838,0.13938,-0.410434,0.33838,0.125278,-0.481331,0.335193,0.169527,-0.413403,0.33838,0.199673,-0.410434,0.33838,0.169527,-0.413403,0.33838,0.213776,-0.481331,0.335193,0.199673,-0.410434,0.33838,0.213776,-0.481331,0.335193,0.228662,-0.401641,0.33838,0.255377,-0.387361,0.33838,0.228662,-0.401641,0.33838,0.295537,-0.447464,0.335192,0.255377,-0.387361,0.33838,0.295537,-0.447464,0.335192,0.278793,-0.368143,0.33838,0.278793,-0.368143,0.33838,0.329907,-0.419257,0.335192,0.298011,-0.344727,0.338379,0.312291,-0.318011,0.338379,0.312291,-0.318011,0.338379,0.379074,-0.345674,0.335192,0.321084,-0.289023,0.338379,0.324053,-0.258877,0.338379,0.321084,-0.289023,0.338379,0.396338,-0.258877,0.335192,0.321084,-0.22873,0.338379,0.321084,-0.22873,0.338379,0.39198,-0.214628,0.335192,0.31229,-0.199742,0.338379,0.31229,-0.199742,0.338379,0.379073,-0.17208,0.335192,0.298011,-0.173027,0.338379,0.298011,-0.173027,0.338379,0.278793,-0.14961,0.338379,0.329907,-0.098497,0.335192,0.255377,-0.130393,0.338379,0.255377,-0.130393,0.338379,0.169527,-0.104351,0.33838,0.228661,-0.116113,0.338379,0.140096,-0.110919,0.268301,0.169527,-0.10802,0.268301,0.13938,-0.10732,0.33838,0.111796,-0.119503,0.268301,0.085715,-0.133444,0.268301,0.111796,-0.119503,0.268301,0.083677,-0.130393,0.33838,0.062855,-0.152205,0.268301,0.044094,-0.175065,0.268301,0.062855,-0.152205,0.268301,0.041043,-0.173027,0.33838,0.030153,-0.201146,0.268302,0.044094,-0.175065,0.268301,0.026763,-0.199742,0.33838,0.021568,-0.229446,0.268302,0.01867,-0.258877,0.268302,0.021568,-0.229446,0.268302,0.015,-0.258877,0.33838,0.021568,-0.288308,0.268302,0.01867,-0.258877,0.268302,0.01797,-0.289023,0.33838,0.030153,-0.316607,0.268302,0.021568,-0.288308,0.268302,0.026763,-0.318012,0.33838,0.030153,-0.316607,0.268302,0.062855,-0.365549,0.268302,0.085715,-0.38431,0.268302,0.062855,-0.365549,0.268302,0.083677,-0.387361,0.33838,0.111796,-0.398251,0.268302,0.085715,-0.38431,0.268302,0.110392,-0.401641,0.33838,0.140096,-0.406835,0.268301,0.111796,-0.398251,0.268302,0.13938,-0.410434,0.33838,0.140096,-0.406835,0.268301,0.13938,-0.410434,0.33838,0.169527,-0.409734,0.268301,0.198957,-0.406835,0.268301,0.169527,-0.409734,0.268301,0.199673,-0.410434,0.33838,0.198957,-0.406835,0.268301,0.199673,-0.410434,0.33838,0.227257,-0.398251,0.268301,0.227257,-0.398251,0.268301,0.228662,-0.401641,0.33838,0.253338,-0.38431,0.268301,0.276199,-0.365549,0.268301,0.253338,-0.38431,0.268301,0.278793,-0.368143,0.33838,0.276199,-0.365549,0.268301,0.278793,-0.368143,0.33838,0.29496,-0.342689,0.268301,0.29496,-0.342689,0.268301,0.298011,-0.344727,0.338379,0.3089,-0.316607,0.268301,0.3089,-0.316607,0.268301,0.312291,-0.318011,0.338379,0.317485,-0.288308,0.268301,0.317485,-0.288308,0.268301,0.321084,-0.289023,0.338379,0.320384,-0.258877,0.268301,0.320384,-0.258877,0.268301,0.317485,-0.229446,0.268301,0.321084,-0.22873,0.338379,0.3089,-0.201146,0.268301,0.29496,-0.175065,0.268301,0.3089,-0.201146,0.268301,0.298011,-0.173027,0.338379,0.29496,-0.175065,0.268301,0.298011,-0.173027,0.338379,0.276199,-0.152205,0.268301,0.276199,-0.152205,0.268301,0.278793,-0.14961,0.338379,0.253338,-0.133444,0.268301,0.253338,-0.133444,0.268301,0.255377,-0.130393,0.338379,0.227257,-0.119503,0.268301,0.169527,-0.10802,0.268301,0.198957,-0.110918,0.268301,0.169527,-0.104351,0.33838,0.227257,-0.119503,0.268301,0.228661,-0.116113,0.338379,0.198957,-0.110918,0.268301,0.169527,-0.032065,0.15433,0.125278,-0.036423,0.15433,0.125278,-0.036423,0.335192,0.125278,-0.036423,0.15433,0.082729,-0.04933,0.15433,0.08273,-0.04933,0.335192,0.08273,-0.04933,0.335192,0.082729,-0.04933,0.15433,0.043517,-0.07029,0.15433,0.043517,-0.07029,0.15433,0.009146,-0.098497,0.15433,0.009147,-0.098497,0.335193,0.009146,-0.098497,0.15433,-0.019061,-0.132867,0.15433,-0.01906,-0.132867,0.335193,-0.019061,-0.132867,0.15433,-0.04002,-0.17208,0.15433,-0.04002,-0.17208,0.335193,-0.04002,-0.17208,0.15433,-0.052927,-0.214628,0.15433,-0.052927,-0.214628,0.335193,-0.052927,-0.214628,0.15433,-0.057285,-0.258877,0.15433,-0.057285,-0.258877,0.335193,-0.057285,-0.258877,0.335193,-0.057285,-0.258877,0.15433,-0.052927,-0.303126,0.15433,-0.052927,-0.303126,0.15433,-0.04002,-0.345674,0.15433,-0.04002,-0.345674,0.335193,-0.04002,-0.345674,0.335193,-0.04002,-0.345674,0.15433,-0.019061,-0.384887,0.15433,-0.019061,-0.384887,0.15433,0.009146,-0.419257,0.15433,0.009147,-0.419257,0.335193,0.009146,-0.419257,0.15433,0.043517,-0.447464,0.15433,0.043517,-0.447464,0.335193,0.043517,-0.447464,0.335193,0.043517,-0.447464,0.15433,0.082729,-0.468424,0.15433,0.08273,-0.468424,0.335193,0.082729,-0.468424,0.15433,0.125278,-0.481331,0.15433,0.125278,-0.481331,0.15433,0.169527,-0.485689,0.15433,0.169527,-0.485689,0.335193,0.169527,-0.485689,0.15433,0.213775,-0.481331,0.15433,0.213776,-0.481331,0.335193,0.213775,-0.481331,0.15433,0.256324,-0.468424,0.15433,0.256324,-0.468424,0.335192,0.256324,-0.468424,0.335192,0.256324,-0.468424,0.15433,0.295536,-0.447464,0.15433,0.295537,-0.447464,0.335192,0.295536,-0.447464,0.15433,0.329907,-0.419257,0.15433,0.329907,-0.419257,0.15433,0.358114,-0.384887,0.15433,0.358114,-0.384887,0.335192,0.358114,-0.384887,0.15433,0.379073,-0.345674,0.15433,0.379074,-0.345674,0.335192,0.379073,-0.345674,0.15433,0.39198,-0.303126,0.15433,0.39198,-0.303126,0.335192,0.39198,-0.303126,0.15433,0.396338,-0.258877,0.15433,0.396338,-0.258877,0.335192,0.396338,-0.258877,0.15433,0.39198,-0.214628,0.15433,0.39198,-0.214628,0.335192,0.39198,-0.214628,0.335192,0.39198,-0.214628,0.15433,0.379073,-0.17208,0.15433,0.379073,-0.17208,0.15433,0.358113,-0.132867,0.15433,0.358114,-0.132867,0.335192,0.358114,-0.132867,0.335192,0.358113,-0.132867,0.15433,0.329906,-0.098497,0.15433,0.329906,-0.098497,0.15433,0.295536,-0.07029,0.15433,0.295536,-0.07029,0.335192,0.295536,-0.07029,0.335192,0.295536,-0.07029,0.15433,0.256323,-0.04933,0.15433,0.213775,-0.036423,0.15433,0.169527,-0.032065,0.15433,0.169527,-0.032065,0.335192,0.256324,-0.04933,0.335192,0.256323,-0.04933,0.15433,0.213775,-0.036423,0.15433,0.169527,-0.032065,0.335192,0.125278,-0.036423,0.335192,0.043517,-0.07029,0.335193,0.043517,-0.07029,0.335193,0.009147,-0.098497,0.335193,-0.01906,-0.132867,0.335193,-0.04002,-0.17208,0.335193,-0.052927,-0.214628,0.335193,-0.052927,-0.303126,0.335193,-0.052927,-0.303126,0.335193,-0.01906,-0.384887,0.335193,-0.01906,-0.384887,0.335193,0.009147,-0.419257,0.335193,0.08273,-0.468424,0.335193,0.125278,-0.481331,0.335193,0.125278,-0.481331,0.335193,0.169527,-0.485689,0.335193,0.213776,-0.481331,0.335193,0.295537,-0.447464,0.335192,0.329907,-0.419257,0.335192,0.329907,-0.419257,0.335192,0.358114,-0.384887,0.335192,0.379074,-0.345674,0.335192,0.39198,-0.303126,0.335192,0.396338,-0.258877,0.335192,0.379073,-0.17208,0.335192,0.379073,-0.17208,0.335192,0.329907,-0.098497,0.335192,0.329907,-0.098497,0.335192,0.256324,-0.04933,0.335192,0.213775,-0.036423,0.335192,0.213775,-0.036423,0.335192,0.457386,-0.085256,-0.18242,0.457386,-0.075628,-0.212108,0.457386,-0.135375,-0.212108,0.491833,-0.075628,-0.212108,0.491833,-0.135375,-0.212108,0.457386,-0.135375,-0.212108,0.491833,-0.094884,0.129605,0.491833,-0.154631,0.129605,0.491833,-0.154631,-0.152732,0.457386,-0.094884,0.129605,0.457386,-0.154631,0.129605,0.491833,-0.154631,0.129605,0.457386,-0.135375,-0.212108,0.491833,-0.135375,-0.212108,0.491833,-0.154631,-0.152732,0.457386,-0.094884,-0.152732,0.457386,-0.154631,-0.152732,0.457386,-0.154631,0.129605,0.491833,-0.075628,-0.212108,0.491833,-0.094884,-0.152732,0.457386,-0.154631,0.129605,0.457386,-0.154631,-0.152732,0.491833,-0.154631,-0.152732,0.491833,-0.094884,0.129605,0.491833,-0.094884,-0.152732,0.457386,-0.094884,-0.152732,0.457386,0.069233,-0.212108,0.457386,0.009486,-0.212108,0.457386,0.021207,-0.18242,0.491833,0.069233,-0.212108,0.491833,0.009486,-0.212108,0.457386,0.009486,-0.212108,0.491833,0.092674,0.129605,0.491833,0.032927,0.129605,0.491833,0.032927,-0.152732,0.457386,0.092674,0.129605,0.457386,0.032927,0.129605,0.491833,0.032927,0.129605,0.491833,0.069233,-0.212108,0.457386,0.069233,-0.212108,0.457386,0.092674,-0.152732,0.457386,0.092674,-0.152732,0.457386,0.032927,-0.152732,0.457386,0.032927,0.129605,0.491833,0.092674,-0.152732,0.491833,0.009486,-0.212108,0.457386,0.032927,0.129605,0.457386,0.032927,-0.152732,0.491833,0.032927,-0.152732,0.491833,0.092674,0.129605,0.491833,0.092674,-0.152732,0.457386,0.092674,-0.152732,0.491833,-0.094884,-0.152732,0.491833,0.032927,-0.152732,0.457386,0.032927,-0.152732,0.428565,0.027234,-0.212108,0.457386,0.021207,-0.18242,0.457386,0.009486,-0.212108,0.491833,-0.075628,-0.212108,0.48253,-0.053192,-0.243948,0.48253,-0.008871,-0.243948,0.457386,-0.075628,-0.243948,0.457386,0.009486,-0.243948,0.48253,-0.008871,-0.243948,-0.108355,0.24994,-0.243948,-0.236385,0.211287,-0.243948,-0.236385,0.211287,-0.212108,0.491833,0.009486,-0.212108,0.48253,-0.008871,-0.243948,0.457386,0.009486,-0.243948,0.491833,-0.075628,-0.212108,0.457386,-0.075628,-0.212108,0.457386,-0.075628,-0.243948,-0.236385,0.211287,-0.212108,-0.236385,0.211287,-0.243948,-0.23958,0.132579,-0.243948,-0.182803,0.079025,-0.212108,-0.23958,0.132579,-0.212108,-0.23958,0.132579,-0.243948,-0.182803,0.079025,-0.243948,-0.23958,0.132579,-0.243948,-0.236385,0.211287,-0.243948,-0.182803,0.079025,-0.212108,-0.108355,0.24994,-0.212108,-0.236385,0.211287,-0.212108,0.457386,0.009486,-0.243948,0.428565,0.027234,-0.243948,0.428565,0.027234,-0.212108,0.457386,-0.075628,-0.212108,0.415755,-0.05691,-0.212108,0.415755,-0.05691,-0.243948,0.457386,-0.075628,-0.243948,0.415755,-0.05691,-0.243948,0.428565,0.027234,-0.243948,0.457386,-0.075628,-0.212108,0.457386,-0.085256,-0.18242,0.415755,-0.05691,-0.212108,0.428565,0.027234,-0.212108,0.428565,0.027234,-0.243948,0.170672,0.151475,-0.243948,0.415755,-0.05691,-0.243948,0.415755,-0.05691,-0.212108,0.133541,0.074887,-0.212108,0.415755,-0.05691,-0.243948,0.133541,0.074887,-0.243948,0.170672,0.151475,-0.243948,0.415755,-0.05691,-0.212108,0.428565,0.027234,-0.212108,0.170672,0.151475,-0.212108,0.170672,0.151475,-0.212108,0.170672,0.151475,-0.243948,-0.108355,0.24994,-0.243948,0.133541,0.074887,-0.212108,-0.182803,0.079025,-0.212108,-0.182803,0.079025,-0.243948,-0.182803,0.079025,-0.243948,0.457386,-0.085256,-0.18242,0.457386,0.021207,-0.18242,0.428565,0.027234,-0.212108,0.457386,-0.075628,-0.212108,0.491833,-0.094884,0.129605,0.457386,-0.154631,-0.152732,0.457386,-0.094884,0.129605,0.491833,-0.135375,-0.212108,0.491833,-0.154631,0.129605,0.457386,-0.094884,0.129605,0.457386,0.069233,-0.212108,0.491833,0.092674,0.129605,0.491833,0.092674,-0.152732,0.457386,0.092674,0.129605,0.491833,0.069233,-0.212108,0.491833,0.032927,0.129605,0.457386,0.092674,0.129605,0.457386,-0.094884,-0.152732,0.491833,0.009486,-0.212108,0.491833,-0.075628,-0.212108,0.48253,-0.008871,-0.243948,0.48253,-0.053192,-0.243948,-0.108355,0.24994,-0.212108,0.457386,0.009486,-0.212108,0.491833,0.009486,-0.212108,0.457386,0.009486,-0.243948,0.48253,-0.053192,-0.243948,0.491833,-0.075628,-0.212108,0.457386,-0.075628,-0.243948,-0.23958,0.132579,-0.212108,-0.182803,0.079025,-0.243948,-0.182803,0.079025,-0.212108,-0.23958,0.132579,-0.243948,-0.108355,0.24994,-0.243948,-0.236385,0.211287,-0.243948,-0.23958,0.132579,-0.212108,0.457386,0.009486,-0.212108,0.457386,0.009486,-0.243948,0.428565,0.027234,-0.212108,0.457386,-0.075628,-0.243948,0.457386,-0.075628,-0.212108,0.415755,-0.05691,-0.243948,0.457386,0.009486,-0.243948,0.457386,-0.075628,-0.243948,0.428565,0.027234,-0.243948,0.170672,0.151475,-0.212108,0.428565,0.027234,-0.212108,0.170672,0.151475,-0.243948,0.133541,0.074887,-0.243948,0.133541,0.074887,-0.212108,-0.108355,0.24994,-0.212108,0.170672,0.151475,-0.212108,-0.108355,0.24994,-0.243948,0.133541,0.074887,-0.243948,0.133541,0.074887,-0.212108,-0.182803,0.079025,-0.243948,0.415755,-0.05691,-0.212108,0.457386,-0.085256,-0.18242,0.428565,0.027234,-0.212108,0.059073,0.383355,0.120943,0.07961,0.348324,0.130295,0.07961,0.348324,0.160182,0.137572,0.383355,0.120943,0.114341,0.348324,0.130295,0.07961,0.348324,0.130295,0.137572,0.383355,0.120943,0.137572,0.383355,0.168131,0.114341,0.348324,0.160182,0.137572,0.383355,0.168131,0.059073,0.383355,0.168131,0.07961,0.348324,0.160182,0.07961,0.348324,0.130295,0.114341,0.348324,0.130295,0.114341,0.348324,0.160182,-0.010466,0.384497,0.108384,-0.015279,0.44388,0.120289,-0.014322,0.432013,0.108384,0.207182,0.366432,0.135844,0.208655,0.372704,0.120289,0.211377,0.384294,0.108384,0.207182,0.366432,0.15268,0.207182,0.366432,0.15268,0.208655,0.372704,0.168235,0.207182,0.366432,0.135844,0.207182,0.366432,0.135844,0.059073,0.383355,0.168131,0.059073,0.383355,0.120943,0.07961,0.348324,0.160182,0.059073,0.383355,0.120943,0.114341,0.348324,0.130295,0.114341,0.348324,0.160182,0.137572,0.383355,0.168131,0.07961,0.348324,0.160182,0.07961,0.348324,0.160182,-0.013071,0.416509,0.101941,-0.011717,0.400001,0.101941,-0.010466,0.384497,0.108384,-0.008991,0.366208,0.135844,-0.015279,0.44388,0.120289,-0.009509,0.37263,0.120289,-0.009509,0.37263,0.168235,-0.015798,0.450302,0.15268,-0.008991,0.366208,0.15268,-0.011717,0.400001,0.186583,-0.014322,0.432013,0.18014,-0.010466,0.384497,0.18014,-0.011717,0.400001,0.186583,-0.013071,0.416509,0.186583,-0.014322,0.432013,0.18014,-0.015798,0.450302,0.15268,-0.009509,0.37263,0.168235,-0.015279,0.44388,0.168235,-0.015279,0.44388,0.120289,-0.008991,0.366208,0.135844,-0.015798,0.450302,0.135844,-0.013071,0.416509,0.101941,-0.010466,0.384497,0.108384,-0.014322,0.432013,0.108384,-0.009509,0.37263,0.168235,-0.014322,0.432013,0.18014,-0.015279,0.44388,0.168235,-0.015279,0.44388,0.120289,-0.010466,0.384497,0.108384,-0.009509,0.37263,0.120289,-0.015798,0.450302,0.15268,-0.008991,0.366208,0.135844,-0.008991,0.366208,0.15268,-0.014322,0.432013,0.18014,-0.009509,0.37263,0.168235,-0.010466,0.384497,0.18014,0.222342,0.43097,0.108384,0.224018,0.443609,0.120289,0.224018,0.450052,0.135844,-0.015798,0.450302,0.135844,0.211377,0.384294,0.108384,0.214934,0.399437,0.101941,0.218784,0.415827,0.101941,0.222342,0.43097,0.18014,0.207182,0.366432,0.15268,0.207182,0.366432,0.135844,0.224018,0.450052,0.15268,0.224018,0.443609,0.168235,0.222342,0.43097,0.18014,0.214934,0.399437,0.186583,0.211377,0.384294,0.18014,0.218784,0.415827,0.186583,0.208655,0.372704,0.168235,0.207182,0.366432,0.15268,0.211377,0.384294,0.18014,0.211377,0.384294,0.108384,0.224018,0.450052,0.135844,0.224018,0.450052,0.15268,0.222342,0.43097,0.18014,0.222342,0.43097,0.108384,0.224018,0.450052,0.135844,0.222342,0.43097,0.18014,0.211377,0.384294,0.18014,0.207182,0.366432,0.15268,0.222342,0.43097,0.18014,0.222342,0.43097,0.18014,0.218784,0.415827,0.101941,0.222342,0.43097,0.108384,0.211377,0.384294,0.18014,0.222342,0.43097,0.18014,0.218784,0.415827,0.186583,0.222342,0.43097,0.18014,0.211377,0.384294,0.108384,0.218784,0.415827,0.101941,0.208655,0.372704,0.168235,-0.158267,0.12396,-0.172425,-0.175114,0.155478,-0.172425,-0.175114,0.155478,-0.209311,-0.12675,0.107113,-0.209311,-0.12675,0.107113,-0.172425,-0.172214,0.184921,-0.172425,-0.158268,0.211013,-0.172425,-0.158268,0.211013,-0.209311,-0.12675,0.22786,-0.172425,-0.12675,0.22786,-0.209311,-0.172214,0.184921,-0.102655,-0.158268,0.211013,-0.102655,-0.158268,0.211013,-0.139541,-0.12675,0.22786,-0.102655,-0.12675,0.22786,-0.139541,-0.054368,0.155478,-0.172425,-0.071214,0.12396,-0.172425,-0.071214,0.12396,-0.209311,-0.097306,0.110013,-0.209311,-0.071214,0.211013,-0.209311,-0.071214,0.211013,-0.172425,-0.057268,0.184921,-0.172425,-0.097306,0.22496,-0.172425,-0.071214,0.211013,-0.139541,-0.071214,0.211013,-0.102655,-0.057268,0.184921,-0.102655,-0.097306,0.22496,-0.139541,-0.097306,0.22496,-0.102655,-0.097306,0.110013,-0.172425,-0.097306,0.22496,-0.209311,-0.131183,0.183928,-0.102655,-0.057268,0.184921,-0.209311,-0.175114,0.155478,-0.102655,-0.172214,0.184921,-0.139541,-0.158267,0.12396,-0.139541,-0.175114,0.155478,-0.139541,-0.054368,0.155478,-0.139541,-0.071214,0.12396,-0.139541,-0.057268,0.184921,-0.139541,-0.158751,0.12396,0.210184,-0.175598,0.155477,0.210184,-0.175598,0.155477,0.173298,-0.158751,0.12396,0.173298,-0.127233,0.107113,0.173298,-0.127233,0.107113,0.210184,-0.172698,0.184921,0.140415,-0.158752,0.211013,0.140415,-0.158752,0.211013,0.103529,-0.127234,0.22786,0.140415,-0.127234,0.22786,0.103529,-0.172698,0.184921,0.103529,-0.172698,0.184921,0.210184,-0.158752,0.211013,0.210184,-0.158752,0.211013,0.173298,-0.127234,0.22786,0.210184,-0.127234,0.22786,0.173298,-0.054852,0.155477,0.210184,-0.071698,0.12396,0.210184,-0.071698,0.12396,0.173298,-0.09779,0.110013,0.210184,-0.071698,0.211013,0.103529,-0.071698,0.211013,0.140415,-0.057752,0.184921,0.140415,-0.09779,0.22496,0.140415,-0.09779,0.22496,0.103529,-0.057752,0.184921,0.103529,-0.071698,0.211013,0.173298,-0.071698,0.211013,0.210184,-0.057752,0.184921,0.210184,-0.09779,0.22496,0.173298,-0.09779,0.110013,0.173298,-0.131667,0.183928,0.103529,-0.09779,0.22496,0.210184,-0.172698,0.184921,0.173298,-0.057752,0.184921,0.173298,-0.158751,0.12396,0.140415,-0.054852,0.155478,0.173298,-0.054852,0.155478,0.140415,-0.038879,0.138131,-0.102446,-0.036813,0.15794,-0.092061,-0.004903,0.169497,-0.085507,-0.063003,0.200722,-0.003034,-0.037117,0.207097,0.014862,-0.026958,0.208801,-0.009262,-0.094299,0.176925,-0.030121,-0.043478,0.196073,-0.047586,-0.080991,0.175048,-0.050132,-0.071155,0.15794,-0.077836,-0.063239,0.175303,-0.065988,-0.054295,0.159266,-0.088539,-0.010231,0.196615,-0.05125,-0.001315,0.207097,-0.01452,0.003697,0.116637,-0.108841,0.002425,0.138131,-0.102446,0.029519,0.14876,-0.088647,0.016674,0.196967,-0.03914,0.039638,0.169211,-0.064677,0.049253,0.187788,-0.011932,0.062826,0.117281,-0.07935,0.035218,0.116616,-0.098015,0.060731,0.168035,-0.039475,0.062792,0.094284,0.082396,0.082691,0.094278,0.056691,0.084764,0.125054,0.045428,0.083832,0.094278,-0.051803,0.087068,0.127846,-0.032567,0.083236,0.150131,0.001073,0.026322,0.200256,0.005501,0.09415,0.094284,-0.020976,0.096388,0.094498,0.024308,-0.003468,0.206923,0.019361,0.065613,0.166193,0.036602,0.026266,0.196271,0.032828,0.002984,0.1391,0.10692,0.046673,0.148756,0.079937,0.039603,0.176081,0.058475,-0.004401,0.196744,0.053862,0.034723,0.116616,0.101033,-0.003418,0.167721,0.089783,-0.036813,0.15794,0.094815,-0.038879,0.138131,0.105199,-0.071155,0.15794,0.08059,-0.054685,0.15794,0.089393,-0.035557,0.184029,0.072589,-0.05472,0.197278,0.038704,-0.075516,0.175303,0.058666,-0.063239,0.175303,0.068742,-0.085592,0.175303,0.046389,-0.099149,0.17705,0.017104,0.09415,0.071931,0.001377,-0.099246,0.175303,0.001377,-0.018227,0.138131,-0.10448,0.062792,0.094284,-0.079643,0.061235,0.116637,0.080839,0.003697,0.116637,0.111594,-0.018227,0.138131,0.107233,0.091027,0.354301,0.134823,0.097668,0.354301,0.133176,0.094547,0.24166,0.131174,0.104105,0.354301,0.135496,0.108168,0.354301,0.141001,0.108968,0.23383,0.141997,0.108488,0.354301,0.147836,0.104956,0.354301,0.153696,0.100355,0.232039,0.155121,0.098764,0.354301,0.156607,0.091999,0.354301,0.155588,0.08694,0.354301,0.150981,0.085116,0.229063,0.146496,0.085292,0.354301,0.14434,0.087612,0.354301,0.137903,0.056768,0.161989,0.037644,0.015399,0.161989,0.055447,0.019778,0.151439,0.062318,0.024002,0.175296,0.0407,0.035874,0.176335,0.034729,0.042659,0.140168,0.061827,0.053449,0.143245,0.054629,0.048179,0.171338,0.033581,0.058747,0.151439,0.045548,0.030015,0.143245,0.064714,0.018353,0.171338,0.046417,0.214934,0.399437,0.101941,0.211377,0.384294,0.108384,-0.010466,0.384497,0.108384,0.208655,0.372704,0.120289,-0.009509,0.37263,0.120289,0.207182,0.366432,0.135844,-0.008991,0.366208,0.135844,0.207182,0.366432,0.15268,-0.008991,0.366208,0.15268,-0.008991,0.366208,0.15268,0.207182,0.366432,0.15268,0.208655,0.372704,0.168235,0.224018,0.450052,0.135844,0.224018,0.450052,0.135844,0.224018,0.443609,0.120289,-0.010466,0.384497,0.18014,0.211377,0.384294,0.18014,0.214934,0.399437,0.186583,-0.011717,0.400001,0.186583,0.218784,0.415827,0.186583,-0.013071,0.416509,0.186583,0.222342,0.43097,0.18014,-0.015798,0.450302,0.135844,0.224018,0.450052,0.135844,0.224018,0.443609,0.120289,0.222342,0.43097,0.18014,0.245206,0.443609,0.168235,0.224018,0.443609,0.168235,0.218784,0.415827,0.101941,-0.011717,0.400001,0.101941,0.249318,0.450052,0.135844,0.245206,0.443609,0.120289,0.224018,0.443609,0.120289,0.224018,0.450052,0.15268,0.224018,0.443609,0.168235,-0.015798,0.450302,0.15268,0.222342,0.43097,0.108384,-0.014322,0.432013,0.108384,-0.014322,0.432013,0.18014,-0.013071,0.416509,0.101941,-0.009509,0.37263,0.168235,0.222342,0.43097,0.108384,0.249318,0.450052,0.15268,0.224018,0.450052,0.135844,0.222342,0.43097,0.18014,0.224018,0.443609,0.168235,-0.015798,0.450302,0.15268,-0.015279,0.44388,0.168235,0.208655,0.372704,0.120289,0.211377,0.384294,0.18014,0.218784,0.415827,0.101941,0.214934,0.399437,0.101941,-0.009509,0.37263,0.120289,-0.010466,0.384497,0.108384,-0.010466,0.384497,0.18014,-0.009509,0.37263,0.168235,0.218784,0.415827,0.186583,0.214934,0.399437,0.186583,-0.013071,0.416509,0.101941,-0.014322,0.432013,0.108384,0.222342,0.43097,0.108384,0.211377,0.384294,0.108384,-0.008991,0.366208,0.15268,-0.015279,0.44388,0.120289,-0.008991,0.366208,0.15268,-0.008991,0.366208,0.135844,-0.015279,0.44388,0.168235,-0.014322,0.432013,0.18014,0.224018,0.443609,0.168235,0.224018,0.450052,0.15268,-0.015279,0.44388,0.120289,-0.015798,0.450302,0.135844,-0.011717,0.400001,0.186583,0.224018,0.443609,0.120289,-0.011717,0.400001,0.101941,-0.013071,0.416509,0.186583,0.224018,0.450052,0.15268,-0.008991,0.366208,0.15268,-0.008991,0.366208,0.15268,0.207182,0.366432,0.15268,-0.158267,0.12396,-0.209311,-0.172214,0.184921,-0.209311,-0.054368,0.155478,-0.209311,-0.098299,0.183928,-0.102655,-0.098783,0.183928,0.103529,-0.175598,0.155477,0.140415,-0.093079,0.175303,0.032381,-0.097689,0.175303,-0.014429,0.224018,0.450052,0.15268,0.207182,0.366432,0.15268,0.397462,0.042189,-0.082466,0.397462,0.001426,-0.082466,0.397462,0.001426,0.086671,0.440872,0.042189,0.086671,0.440872,0.001426,0.086671,0.440872,0.001426,-0.082466,0.397462,0.001426,-0.082466,0.440872,0.001426,-0.082466,0.440872,0.001426,0.086671,0.440872,0.042189,-0.082466,0.397462,0.042189,-0.082466,0.397462,0.042189,0.086671,0.416504,-0.242734,-0.082466,0.416504,-0.283498,-0.082466,0.248656,-0.283498,-0.082466,0.416504,-0.242734,0.086671,0.416504,-0.283498,0.086671,0.416504,-0.283498,-0.082466,0.248656,-0.242734,0.086671,0.248656,-0.283498,0.086671,0.416504,-0.283498,0.086671,0.248656,-0.283498,-0.082466,0.416504,-0.283498,-0.082466,0.416504,-0.283498,0.086671,0.416504,-0.242734,-0.082466,0.248656,-0.242734,-0.082466,0.248656,-0.242734,0.086671,0.381312,0.391928,0.05151,0.381312,-0.450046,0.05151,0.381312,-0.450046,0.096934,0.45283,0.391928,0.05151,0.45283,-0.450046,0.05151,0.381312,-0.450046,0.05151,0.45283,0.391928,0.096934,0.45283,-0.450046,0.096934,0.45283,-0.450046,0.05151,0.381312,0.391928,0.096934,0.381312,-0.450046,0.096934,0.45283,-0.450046,0.096934,0.381312,-0.450046,0.05151,0.45283,-0.450046,0.05151,0.45283,-0.450046,0.096934,0.45283,0.391928,0.05151,0.381312,0.391928,0.05151,0.381312,0.391928,0.096934,0.381312,0.391928,-0.087783,0.381312,-0.450046,-0.087783,0.381312,-0.450046,-0.042358,0.45283,0.391928,-0.087783,0.45283,-0.450046,-0.087783,0.381312,-0.450046,-0.087783,0.45283,0.391928,-0.042358,0.45283,-0.450046,-0.042358,0.45283,-0.450046,-0.087783,0.381312,0.391928,-0.042358,0.381312,-0.450046,-0.042358,0.45283,-0.450046,-0.042358,0.381312,-0.450046,-0.087783,0.45283,-0.450046,-0.087783,0.45283,-0.450046,-0.042358,0.45283,0.391928,-0.087783,0.381312,0.391928,-0.087783,0.381312,0.391928,-0.042358,0.397462,0.042189,0.086671,0.440872,0.042189,-0.082466,0.397462,0.001426,0.086671,0.440872,0.042189,0.086671,0.248656,-0.242734,-0.082466,0.416504,-0.242734,-0.082466,0.416504,-0.242734,0.086671,0.248656,-0.283498,0.086671,0.416504,-0.242734,0.086671,0.381312,0.391928,0.096934,0.381312,0.391928,0.05151,0.45283,0.391928,0.05151,0.45283,0.391928,0.096934,0.381312,-0.450046,0.096934,0.45283,0.391928,0.096934,0.381312,0.391928,-0.042358,0.381312,0.391928,-0.087783,0.45283,0.391928,-0.087783,0.45283,0.391928,-0.042358,0.381312,-0.450046,-0.042358,0.45283,0.391928,-0.042358,-0.478671,-0.356388,0.039952,-0.235693,-0.308057,0.039952,-0.422542,-0.4614,0.039952,-0.377014,-0.480258,0.128379,-0.228506,-0.381027,0.128379,-0.327736,-0.232519,0.128379,-0.352375,-0.482684,0.039952,-0.377014,-0.480258,0.039952,-0.327736,-0.480258,0.039952,-0.400707,-0.473071,0.039952,-0.422542,-0.4614,0.039952,-0.377014,-0.480258,0.039952,-0.44168,-0.445693,0.039952,-0.469058,-0.40472,0.039952,-0.422542,-0.4614,0.039952,-0.44168,-0.445693,0.039952,-0.457387,-0.426555,0.039952,-0.469058,-0.40472,0.039952,-0.476245,-0.381028,0.039952,-0.377014,-0.480258,0.039952,-0.304044,-0.473071,0.039952,-0.327736,-0.480258,0.039952,-0.469058,-0.308057,0.039952,-0.457387,-0.286222,0.039952,-0.44168,-0.267084,0.039952,-0.400707,-0.239706,0.039952,-0.476245,-0.331749,0.039952,-0.422542,-0.251377,0.039952,-0.352375,-0.230092,0.039952,-0.327736,-0.232519,0.039952,-0.377015,-0.232519,0.039952,-0.327736,-0.232519,0.039952,-0.282209,-0.251377,0.039952,-0.263071,-0.267084,0.039952,-0.247364,-0.286222,0.039952,-0.235693,-0.308057,0.039952,-0.228506,-0.331749,0.039952,-0.226079,-0.356388,0.039952,-0.226079,-0.356388,0.039952,-0.228506,-0.381027,0.039952,-0.235693,-0.40472,0.039952,-0.263071,-0.445693,0.039952,-0.304044,-0.473071,0.039952,-0.247364,-0.426555,0.039952,-0.263071,-0.445693,0.039952,-0.282209,-0.4614,0.039952,-0.304044,-0.473071,0.039952,-0.304044,-0.239706,0.039952,-0.247364,-0.426555,0.039952,-0.377015,-0.232519,0.039952,-0.377014,-0.480258,0.128379,-0.352375,-0.482684,0.128379,-0.327736,-0.480258,0.128379,-0.235693,-0.308057,0.128379,-0.247364,-0.286222,0.128379,-0.263071,-0.267083,0.128379,-0.247364,-0.426555,0.128379,-0.377014,-0.480258,0.128379,-0.263071,-0.445693,0.128379,-0.247364,-0.426555,0.128379,-0.235693,-0.40472,0.128379,-0.228506,-0.331749,0.128379,-0.226079,-0.356388,0.128379,-0.226079,-0.356388,0.128379,-0.235693,-0.308057,0.128379,-0.282209,-0.251377,0.128379,-0.282209,-0.251377,0.128379,-0.235693,-0.308057,0.128379,-0.263071,-0.267083,0.128379,-0.282209,-0.251377,0.128379,-0.304044,-0.239706,0.128379,-0.327736,-0.232519,0.128379,-0.377015,-0.232519,0.128379,-0.422542,-0.251377,0.128379,-0.352375,-0.230092,0.128379,-0.377015,-0.232519,0.128379,-0.400707,-0.239706,0.128379,-0.422542,-0.251377,0.128379,-0.457387,-0.286222,0.128379,-0.469058,-0.308057,0.128379,-0.44168,-0.267083,0.128379,-0.476245,-0.331749,0.128379,-0.422542,-0.251377,0.128379,-0.469058,-0.308057,0.128379,-0.457387,-0.426555,0.128379,-0.478671,-0.356388,0.128379,-0.469058,-0.40472,0.128379,-0.457387,-0.426555,0.128379,-0.44168,-0.445693,0.128379,-0.422542,-0.4614,0.128379,-0.422542,-0.4614,0.128379,-0.400707,-0.473071,0.128379,-0.377014,-0.480258,0.128379,-0.304044,-0.473071,0.128379,-0.282209,-0.4614,0.128379,-0.263071,-0.445693,0.128379,-0.478671,-0.356388,0.128379,-0.457387,-0.426555,0.128379,-0.422542,-0.4614,0.128379,-0.282209,-0.251377,0.128379,-0.478671,-0.356388,0.128379,-0.476245,-0.381028,0.128379,-0.469058,-0.40472,0.128379,-0.469058,-0.308057,0.128379,-0.422542,-0.251377,0.128379,-0.44168,-0.267083,0.128379,-0.304044,-0.473071,0.128379,-0.263071,-0.445693,0.128379,-0.352375,-0.230092,0.128379,-0.422542,-0.251377,0.128379,-0.476245,-0.331749,0.128379,-0.304044,-0.473071,0.128379,-0.422542,-0.4614,0.128379,-0.377014,-0.480258,0.128379,-0.327736,-0.232519,0.128379,-0.422542,-0.4614,0.128379,-0.478671,-0.356388,0.128379,-0.352375,-0.482684,0.039952,-0.327736,-0.480258,0.039952,-0.327736,-0.480258,0.128379,-0.327736,-0.480258,0.128379,-0.327736,-0.480258,0.039952,-0.304044,-0.473071,0.039952,-0.304044,-0.473071,0.039952,-0.282209,-0.4614,0.039952,-0.282209,-0.4614,0.128379,-0.282209,-0.4614,0.039952,-0.263071,-0.445693,0.039952,-0.263071,-0.445693,0.128379,-0.263071,-0.445693,0.039952,-0.247364,-0.426555,0.039952,-0.247364,-0.426555,0.128379,-0.247364,-0.426555,0.128379,-0.247364,-0.426555,0.039952,-0.235693,-0.40472,0.039952,-0.235693,-0.40472,0.039952,-0.228506,-0.381027,0.039952,-0.228506,-0.381027,0.128379,-0.228506,-0.381027,0.039952,-0.226079,-0.356388,0.039952,-0.226079,-0.356388,0.128379,-0.226079,-0.356388,0.128379,-0.226079,-0.356388,0.039952,-0.228506,-0.331749,0.039952,-0.228506,-0.331749,0.039952,-0.235693,-0.308057,0.039952,-0.235693,-0.308057,0.128379,-0.235693,-0.308057,0.039952,-0.247364,-0.286222,0.039952,-0.247364,-0.286222,0.128379,-0.247364,-0.286222,0.039952,-0.263071,-0.267084,0.039952,-0.263071,-0.267083,0.128379,-0.263071,-0.267084,0.039952,-0.282209,-0.251377,0.039952,-0.282209,-0.251377,0.128379,-0.282209,-0.251377,0.039952,-0.304044,-0.239706,0.039952,-0.304044,-0.239706,0.128379,-0.304044,-0.239706,0.039952,-0.327736,-0.232519,0.039952,-0.327736,-0.232519,0.128379,-0.327736,-0.232519,0.039952,-0.352375,-0.230092,0.039952,-0.352375,-0.230092,0.128379,-0.352375,-0.230092,0.039952,-0.377015,-0.232519,0.039952,-0.377015,-0.232519,0.128379,-0.377015,-0.232519,0.039952,-0.400707,-0.239706,0.039952,-0.400707,-0.239706,0.128379,-0.400707,-0.239706,0.039952,-0.422542,-0.251377,0.039952,-0.422542,-0.251377,0.128379,-0.422542,-0.251377,0.039952,-0.44168,-0.267084,0.039952,-0.44168,-0.267083,0.128379,-0.44168,-0.267083,0.128379,-0.44168,-0.267084,0.039952,-0.457387,-0.286222,0.039952,-0.457387,-0.286222,0.039952,-0.469058,-0.308057,0.039952,-0.469058,-0.308057,0.128379,-0.469058,-0.308057,0.039952,-0.476245,-0.331749,0.039952,-0.476245,-0.331749,0.128379,-0.476245,-0.331749,0.039952,-0.478671,-0.356388,0.039952,-0.478671,-0.356388,0.128379,-0.478671,-0.356388,0.039952,-0.476245,-0.381028,0.039952,-0.476245,-0.381028,0.128379,-0.476245,-0.381028,0.128379,-0.476245,-0.381028,0.039952,-0.469058,-0.40472,0.039952,-0.469058,-0.40472,0.039952,-0.457387,-0.426555,0.039952,-0.457387,-0.426555,0.128379,-0.457387,-0.426555,0.039952,-0.44168,-0.445693,0.039952,-0.44168,-0.445693,0.128379,-0.44168,-0.445693,0.039952,-0.422542,-0.4614,0.039952,-0.422542,-0.4614,0.128379,-0.422542,-0.4614,0.039952,-0.400707,-0.473071,0.039952,-0.400707,-0.473071,0.128379,-0.377014,-0.480258,0.128379,-0.377014,-0.480258,0.039952,-0.352375,-0.482684,0.039952,-0.400707,-0.473071,0.039952,-0.377014,-0.480258,0.039952,-0.377014,-0.480258,0.128379,-0.352375,-0.482684,0.128379,-0.304044,-0.473071,0.128379,-0.304044,-0.473071,0.128379,-0.282209,-0.4614,0.128379,-0.263071,-0.445693,0.128379,-0.235693,-0.40472,0.128379,-0.235693,-0.40472,0.128379,-0.228506,-0.381027,0.128379,-0.228506,-0.331749,0.128379,-0.228506,-0.331749,0.128379,-0.235693,-0.308057,0.128379,-0.247364,-0.286222,0.128379,-0.263071,-0.267083,0.128379,-0.282209,-0.251377,0.128379,-0.304044,-0.239706,0.128379,-0.327736,-0.232519,0.128379,-0.352375,-0.230092,0.128379,-0.377015,-0.232519,0.128379,-0.400707,-0.239706,0.128379,-0.422542,-0.251377,0.128379,-0.457387,-0.286222,0.128379,-0.457387,-0.286222,0.128379,-0.469058,-0.308057,0.128379,-0.476245,-0.331749,0.128379,-0.478671,-0.356388,0.128379,-0.469058,-0.40472,0.128379,-0.469058,-0.40472,0.128379,-0.457387,-0.426555,0.128379,-0.44168,-0.445693,0.128379,-0.422542,-0.4614,0.128379,-0.352375,-0.482684,0.128379,-0.400707,-0.473071,0.128379,-0.400707,-0.473071,-0.035786,-0.263071,-0.267084,-0.035786,-0.400707,-0.239706,-0.035786,-0.327736,-0.480258,-0.124213,-0.476245,-0.381027,-0.124213,-0.228506,-0.331749,-0.124213,-0.327736,-0.480258,-0.035786,-0.282209,-0.4614,-0.035786,-0.327736,-0.232519,-0.035786,-0.377014,-0.232519,-0.035786,-0.400707,-0.239706,-0.035786,-0.422542,-0.251377,-0.035786,-0.44168,-0.267083,-0.035786,-0.469058,-0.308057,-0.035786,-0.478671,-0.356388,-0.035786,-0.457387,-0.286222,-0.035786,-0.469058,-0.308057,-0.035786,-0.476245,-0.331749,-0.035786,-0.478671,-0.356388,-0.035786,-0.478671,-0.356388,-0.035786,-0.476245,-0.381027,-0.035786,-0.469058,-0.40472,-0.035786,-0.457387,-0.426555,-0.035786,-0.44168,-0.445693,-0.035786,-0.422542,-0.4614,-0.035786,-0.400707,-0.473071,-0.035786,-0.400707,-0.473071,-0.035786,-0.377015,-0.480258,-0.035786,-0.352375,-0.482684,-0.035786,-0.304044,-0.473071,-0.035786,-0.282209,-0.4614,-0.035786,-0.327736,-0.480258,-0.035786,-0.247364,-0.426555,-0.035786,-0.235693,-0.40472,-0.035786,-0.226079,-0.356388,-0.035786,-0.44168,-0.267083,-0.035786,-0.235693,-0.40472,-0.035786,-0.228506,-0.381027,-0.035786,-0.226079,-0.356388,-0.035786,-0.263071,-0.267084,-0.035786,-0.228506,-0.331749,-0.035786,-0.247364,-0.286222,-0.035786,-0.304044,-0.239706,-0.035786,-0.327736,-0.232519,-0.035786,-0.282209,-0.251377,-0.035786,-0.282209,-0.251377,-0.035786,-0.469058,-0.40472,-0.035786,-0.44168,-0.445693,-0.035786,-0.352375,-0.482684,-0.035786,-0.282209,-0.4614,-0.035786,-0.263071,-0.445693,-0.035786,-0.247364,-0.426555,-0.035786,-0.228506,-0.331749,-0.035786,-0.235693,-0.308057,-0.035786,-0.247364,-0.286222,-0.035786,-0.327736,-0.232519,-0.035786,-0.352375,-0.230092,-0.035786,-0.377014,-0.232519,-0.035786,-0.327736,-0.232519,-0.124213,-0.352375,-0.230092,-0.124213,-0.327736,-0.232519,-0.124213,-0.304044,-0.239706,-0.124213,-0.282209,-0.251377,-0.124213,-0.247364,-0.286222,-0.124213,-0.228506,-0.331749,-0.124213,-0.263071,-0.267083,-0.124213,-0.247364,-0.286222,-0.124213,-0.235693,-0.308057,-0.124213,-0.228506,-0.331749,-0.124213,-0.44168,-0.267083,-0.124213,-0.422542,-0.251377,-0.124213,-0.400707,-0.239706,-0.124213,-0.247364,-0.426555,-0.124213,-0.226079,-0.356388,-0.124213,-0.235693,-0.40472,-0.124213,-0.247364,-0.426555,-0.124213,-0.263071,-0.445693,-0.124213,-0.282209,-0.4614,-0.124213,-0.282209,-0.4614,-0.124213,-0.304044,-0.473071,-0.124213,-0.327736,-0.480258,-0.124213,-0.377015,-0.480258,-0.124213,-0.400707,-0.473071,-0.124213,-0.352375,-0.482684,-0.124213,-0.44168,-0.445693,-0.124213,-0.457387,-0.426555,-0.124213,-0.469058,-0.40472,-0.124213,-0.478671,-0.356388,-0.124213,-0.476245,-0.331749,-0.124213,-0.469058,-0.308057,-0.124213,-0.247364,-0.426555,-0.124213,-0.228506,-0.331749,-0.124213,-0.226079,-0.356388,-0.124213,-0.457387,-0.286222,-0.124213,-0.469058,-0.40472,-0.124213,-0.476245,-0.381027,-0.124213,-0.400707,-0.473071,-0.124213,-0.377014,-0.232519,-0.124213,-0.44168,-0.267083,-0.124213,-0.400707,-0.239706,-0.124213,-0.282209,-0.251377,-0.124213,-0.263071,-0.267083,-0.124213,-0.327736,-0.232519,-0.124213,-0.263071,-0.267083,-0.124213,-0.327736,-0.232519,-0.124213,-0.327736,-0.480258,-0.124213,-0.228506,-0.331749,-0.124213,-0.282209,-0.4614,-0.124213,-0.422542,-0.4614,-0.124213,-0.44168,-0.445693,-0.124213,-0.400707,-0.473071,-0.124213,-0.44168,-0.445693,-0.124213,-0.469058,-0.40472,-0.124213,-0.400707,-0.473071,-0.124213,-0.476245,-0.381027,-0.124213,-0.478671,-0.356388,-0.124213,-0.377014,-0.232519,-0.124213,-0.247364,-0.426555,-0.124213,-0.282209,-0.4614,-0.124213,-0.226079,-0.356388,-0.124213,-0.228506,-0.381027,-0.124213,-0.235693,-0.40472,-0.124213,-0.352375,-0.230092,-0.035786,-0.327736,-0.232519,-0.035786,-0.327736,-0.232519,-0.124213,-0.327736,-0.232519,-0.035786,-0.304044,-0.239706,-0.035786,-0.304044,-0.239706,-0.124213,-0.304044,-0.239706,-0.124213,-0.304044,-0.239706,-0.035786,-0.282209,-0.251377,-0.035786,-0.282209,-0.251377,-0.035786,-0.263071,-0.267084,-0.035786,-0.263071,-0.267083,-0.124213,-0.263071,-0.267084,-0.035786,-0.247364,-0.286222,-0.035786,-0.247364,-0.286222,-0.124213,-0.247364,-0.286222,-0.035786,-0.235693,-0.308057,-0.035786,-0.235693,-0.308057,-0.124213,-0.235693,-0.308057,-0.035786,-0.228506,-0.331749,-0.035786,-0.228506,-0.331749,-0.124213,-0.228506,-0.331749,-0.035786,-0.226079,-0.356388,-0.035786,-0.226079,-0.356388,-0.124213,-0.226079,-0.356388,-0.124213,-0.226079,-0.356388,-0.035786,-0.228506,-0.381027,-0.035786,-0.228506,-0.381027,-0.124213,-0.228506,-0.381027,-0.035786,-0.235693,-0.40472,-0.035786,-0.235693,-0.40472,-0.035786,-0.247364,-0.426555,-0.035786,-0.247364,-0.426555,-0.124213,-0.247364,-0.426555,-0.035786,-0.263071,-0.445693,-0.035786,-0.263071,-0.445693,-0.124213,-0.263071,-0.445693,-0.124213,-0.263071,-0.445693,-0.035786,-0.282209,-0.4614,-0.035786,-0.282209,-0.4614,-0.035786,-0.304044,-0.473071,-0.035786,-0.304044,-0.473071,-0.124213,-0.304044,-0.473071,-0.035786,-0.327736,-0.480258,-0.035786,-0.327736,-0.480258,-0.124213,-0.327736,-0.480258,-0.035786,-0.352375,-0.482684,-0.035786,-0.352375,-0.482684,-0.124213,-0.352375,-0.482684,-0.035786,-0.377015,-0.480258,-0.035786,-0.377015,-0.480258,-0.124213,-0.377015,-0.480258,-0.035786,-0.400707,-0.473071,-0.035786,-0.400707,-0.473071,-0.124213,-0.400707,-0.473071,-0.035786,-0.422542,-0.4614,-0.035786,-0.422542,-0.4614,-0.124213,-0.422542,-0.4614,-0.124213,-0.422542,-0.4614,-0.035786,-0.44168,-0.445693,-0.035786,-0.44168,-0.445693,-0.035786,-0.457387,-0.426555,-0.035786,-0.457387,-0.426555,-0.124213,-0.457387,-0.426555,-0.035786,-0.469058,-0.40472,-0.035786,-0.469058,-0.40472,-0.124213,-0.469058,-0.40472,-0.035786,-0.476245,-0.381027,-0.035786,-0.476245,-0.381027,-0.124213,-0.476245,-0.381027,-0.035786,-0.478671,-0.356388,-0.035786,-0.478671,-0.356388,-0.124213,-0.478671,-0.356388,-0.035786,-0.476245,-0.331749,-0.035786,-0.476245,-0.331749,-0.124213,-0.476245,-0.331749,-0.035786,-0.469058,-0.308057,-0.035786,-0.469058,-0.308057,-0.124213,-0.469058,-0.308057,-0.035786,-0.457387,-0.286222,-0.035786,-0.457387,-0.286222,-0.124213,-0.457387,-0.286222,-0.124213,-0.457387,-0.286222,-0.035786,-0.44168,-0.267083,-0.035786,-0.44168,-0.267083,-0.124213,-0.44168,-0.267083,-0.035786,-0.422542,-0.251377,-0.035786,-0.422542,-0.251377,-0.035786,-0.400707,-0.239706,-0.035786,-0.400707,-0.239706,-0.124213,-0.377014,-0.232519,-0.124213,-0.377014,-0.232519,-0.035786,-0.352375,-0.230092,-0.035786,-0.400707,-0.239706,-0.035786,-0.377014,-0.232519,-0.035786,-0.377014,-0.232519,-0.124213,-0.352375,-0.230092,-0.124213,-0.327736,-0.232519,-0.124213,-0.282209,-0.251377,-0.124213,-0.282209,-0.251377,-0.124213,-0.263071,-0.267083,-0.124213,-0.247364,-0.286222,-0.124213,-0.235693,-0.308057,-0.124213,-0.228506,-0.331749,-0.124213,-0.228506,-0.381027,-0.124213,-0.235693,-0.40472,-0.124213,-0.235693,-0.40472,-0.124213,-0.247364,-0.426555,-0.124213,-0.282209,-0.4614,-0.124213,-0.282209,-0.4614,-0.124213,-0.304044,-0.473071,-0.124213,-0.327736,-0.480258,-0.124213,-0.352375,-0.482684,-0.124213,-0.377015,-0.480258,-0.124213,-0.400707,-0.473071,-0.124213,-0.44168,-0.445693,-0.124213,-0.44168,-0.445693,-0.124213,-0.457387,-0.426555,-0.124213,-0.469058,-0.40472,-0.124213,-0.476245,-0.381027,-0.124213,-0.478671,-0.356388,-0.124213,-0.476245,-0.331749,-0.124213,-0.469058,-0.308057,-0.124213,-0.44168,-0.267083,-0.124213,-0.422542,-0.251377,-0.124213,-0.422542,-0.251377,-0.124213,-0.400707,-0.239706,-0.124213,-0.352375,-0.230092,-0.124213,0.379073,-0.345674,-0.157961,0.256323,-0.04933,-0.15796,-0.04002,-0.17208,-0.157961,0.021568,-0.288308,-0.271932,0.044093,-0.175065,-0.271932,0.317485,-0.229446,-0.271932,0.169526,-0.032065,-0.338823,0.213775,-0.036423,-0.338823,0.199673,-0.10732,-0.34201,0.213775,-0.036423,-0.338823,0.256323,-0.04933,-0.338823,0.228661,-0.116113,-0.34201,0.228661,-0.116113,-0.34201,0.256323,-0.04933,-0.338823,0.295536,-0.07029,-0.338823,0.295536,-0.07029,-0.338823,0.329906,-0.098497,-0.338823,0.278793,-0.14961,-0.34201,0.278793,-0.14961,-0.34201,0.329906,-0.098497,-0.338823,0.358113,-0.132867,-0.338823,0.29801,-0.173027,-0.34201,0.358113,-0.132867,-0.338823,0.379073,-0.17208,-0.338823,0.31229,-0.199742,-0.34201,0.379073,-0.17208,-0.338823,0.39198,-0.214628,-0.338823,0.321084,-0.22873,-0.34201,0.39198,-0.214628,-0.338823,0.396338,-0.258877,-0.338823,0.396338,-0.258877,-0.338823,0.39198,-0.303126,-0.338823,0.321084,-0.289023,-0.34201,0.321084,-0.289023,-0.34201,0.39198,-0.303126,-0.338823,0.379073,-0.345674,-0.338823,0.31229,-0.318012,-0.34201,0.379073,-0.345674,-0.338823,0.358113,-0.384887,-0.338823,0.29801,-0.344727,-0.34201,0.358113,-0.384887,-0.338823,0.329906,-0.419257,-0.338823,0.278793,-0.368143,-0.34201,0.329906,-0.419257,-0.338823,0.295536,-0.447464,-0.338823,0.295536,-0.447464,-0.338823,0.256323,-0.468424,-0.338823,0.228661,-0.401641,-0.34201,0.256323,-0.468424,-0.338823,0.213775,-0.481331,-0.338823,0.199673,-0.410434,-0.34201,0.213775,-0.481331,-0.338823,0.169526,-0.485689,-0.338823,0.169526,-0.413403,-0.34201,0.169526,-0.413403,-0.34201,0.169526,-0.485689,-0.338823,0.125278,-0.481331,-0.338823,0.125278,-0.481331,-0.338823,0.082729,-0.468424,-0.338823,0.110392,-0.401641,-0.34201,0.082729,-0.468424,-0.338823,0.043516,-0.447464,-0.338823,0.083676,-0.387361,-0.34201,0.043516,-0.447464,-0.338823,0.009146,-0.419257,-0.338823,0.06026,-0.368143,-0.34201,0.009146,-0.419257,-0.338823,-0.019061,-0.384887,-0.338823,0.041042,-0.344727,-0.34201,-0.019061,-0.384887,-0.338823,-0.04002,-0.345674,-0.338823,0.026763,-0.318011,-0.34201,-0.04002,-0.345674,-0.338823,-0.052927,-0.303126,-0.338823,0.017969,-0.289023,-0.34201,-0.052927,-0.303126,-0.338823,-0.057285,-0.258877,-0.338823,0.015,-0.258877,-0.34201,0.015,-0.258877,-0.34201,-0.057285,-0.258877,-0.338823,-0.052927,-0.214628,-0.338823,-0.052927,-0.214628,-0.338823,-0.04002,-0.17208,-0.338823,0.026763,-0.199742,-0.34201,-0.04002,-0.17208,-0.338823,-0.019061,-0.132867,-0.338823,0.041043,-0.173027,-0.34201,-0.019061,-0.132867,-0.338823,0.009146,-0.098497,-0.338823,0.06026,-0.14961,-0.34201,0.009146,-0.098497,-0.338823,0.043517,-0.07029,-0.338823,0.083676,-0.130393,-0.34201,0.043517,-0.07029,-0.338823,0.08273,-0.04933,-0.338823,0.110392,-0.116113,-0.34201,0.125278,-0.036423,-0.338823,0.169526,-0.032065,-0.338823,0.169526,-0.104351,-0.34201,0.08273,-0.04933,-0.338823,0.125278,-0.036423,-0.338823,0.13938,-0.10732,-0.34201,0.169526,-0.10802,-0.271932,0.169526,-0.104351,-0.34201,0.199673,-0.10732,-0.34201,0.199673,-0.10732,-0.34201,0.228661,-0.116113,-0.34201,0.227257,-0.119503,-0.271932,0.227257,-0.119503,-0.271932,0.228661,-0.116113,-0.34201,0.255377,-0.130393,-0.34201,0.253338,-0.133444,-0.271932,0.255377,-0.130393,-0.34201,0.278793,-0.14961,-0.34201,0.278793,-0.14961,-0.34201,0.29801,-0.173027,-0.34201,0.294959,-0.175065,-0.271932,0.294959,-0.175065,-0.271932,0.29801,-0.173027,-0.34201,0.31229,-0.199742,-0.34201,0.3089,-0.201146,-0.271932,0.31229,-0.199742,-0.34201,0.321084,-0.22873,-0.34201,0.321084,-0.22873,-0.34201,0.324053,-0.258877,-0.34201,0.320383,-0.258877,-0.271932,0.320383,-0.258877,-0.271932,0.324053,-0.258877,-0.34201,0.321084,-0.289023,-0.34201,0.321084,-0.289023,-0.34201,0.31229,-0.318012,-0.34201,0.3089,-0.316607,-0.271932,0.3089,-0.316607,-0.271932,0.31229,-0.318012,-0.34201,0.29801,-0.344727,-0.34201,0.294959,-0.342689,-0.271932,0.29801,-0.344727,-0.34201,0.278793,-0.368143,-0.34201,0.278793,-0.368143,-0.34201,0.255377,-0.387361,-0.34201,0.253338,-0.38431,-0.271932,0.255377,-0.387361,-0.34201,0.228661,-0.401641,-0.34201,0.227257,-0.398251,-0.271932,0.228661,-0.401641,-0.34201,0.199673,-0.410434,-0.34201,0.198957,-0.406835,-0.271932,0.199673,-0.410434,-0.34201,0.169526,-0.413403,-0.34201,0.169526,-0.409734,-0.271932,0.169526,-0.409734,-0.271932,0.169526,-0.413403,-0.34201,0.13938,-0.410434,-0.34201,0.13938,-0.410434,-0.34201,0.110392,-0.401641,-0.34201,0.111796,-0.398251,-0.271932,0.110392,-0.401641,-0.34201,0.083676,-0.387361,-0.34201,0.085715,-0.38431,-0.271932,0.083676,-0.387361,-0.34201,0.06026,-0.368143,-0.34201,0.062854,-0.365549,-0.271932,0.06026,-0.368143,-0.34201,0.041042,-0.344727,-0.34201,0.044093,-0.342689,-0.271932,0.041042,-0.344727,-0.34201,0.026763,-0.318011,-0.34201,0.030153,-0.316607,-0.271932,0.030153,-0.316607,-0.271932,0.026763,-0.318011,-0.34201,0.017969,-0.289023,-0.34201,0.017969,-0.289023,-0.34201,0.015,-0.258877,-0.34201,0.018669,-0.258877,-0.271932,0.015,-0.258877,-0.34201,0.017969,-0.22873,-0.34201,0.021568,-0.229446,-0.271932,0.017969,-0.22873,-0.34201,0.026763,-0.199742,-0.34201,0.030153,-0.201146,-0.271932,0.026763,-0.199742,-0.34201,0.041043,-0.173027,-0.34201,0.044093,-0.175065,-0.271932,0.041043,-0.173027,-0.34201,0.06026,-0.14961,-0.34201,0.062854,-0.152205,-0.271932,0.06026,-0.14961,-0.34201,0.083676,-0.130393,-0.34201,0.085715,-0.133444,-0.271932,0.083676,-0.130393,-0.34201,0.110392,-0.116113,-0.34201,0.111796,-0.119503,-0.271932,0.13938,-0.10732,-0.34201,0.169526,-0.104351,-0.34201,0.169526,-0.10802,-0.271932,0.110392,-0.116113,-0.34201,0.13938,-0.10732,-0.34201,0.140096,-0.110918,-0.271932,0.169526,-0.032065,-0.15796,0.125278,-0.036423,-0.15796,0.213775,-0.036423,-0.15796,0.125278,-0.036423,-0.15796,0.08273,-0.04933,-0.15796,0.009146,-0.098497,-0.15796,0.08273,-0.04933,-0.15796,0.043517,-0.07029,-0.15796,0.009146,-0.098497,-0.15796,-0.019061,-0.132867,-0.157961,-0.057285,-0.258877,-0.157961,-0.052927,-0.303126,-0.157961,-0.052927,-0.214628,-0.157961,-0.019061,-0.384887,-0.157961,0.082729,-0.468424,-0.157961,0.169526,-0.485689,-0.157961,0.256323,-0.04933,-0.15796,0.082729,-0.468424,-0.157961,-0.019061,-0.384887,-0.157961,0.043516,-0.447464,-0.157961,0.082729,-0.468424,-0.157961,0.125278,-0.481331,-0.157961,0.169526,-0.485689,-0.157961,0.213775,-0.481331,-0.157961,0.256323,-0.468424,-0.157961,0.295536,-0.447464,-0.157961,0.329906,-0.419257,-0.157961,0.213775,-0.481331,-0.157961,0.295536,-0.447464,-0.157961,0.329906,-0.419257,-0.157961,0.358113,-0.384887,-0.157961,0.379073,-0.345674,-0.157961,0.379073,-0.345674,-0.157961,0.39198,-0.303126,-0.157961,0.396338,-0.258877,-0.157961,0.379073,-0.17208,-0.157961,0.379073,-0.345674,-0.157961,0.39198,-0.214628,-0.157961,0.379073,-0.17208,-0.157961,0.358113,-0.132867,-0.157961,0.329906,-0.098497,-0.15796,0.329906,-0.098497,-0.15796,0.295536,-0.07029,-0.15796,0.256323,-0.04933,-0.15796,-0.019061,-0.384887,-0.157961,0.169526,-0.485689,-0.157961,0.213775,-0.481331,-0.157961,-0.052927,-0.303126,-0.157961,-0.04002,-0.345674,-0.157961,-0.019061,-0.384887,-0.157961,-0.052927,-0.303126,-0.157961,-0.019061,-0.384887,-0.157961,-0.04002,-0.17208,-0.157961,0.379073,-0.345674,-0.157961,0.396338,-0.258877,-0.157961,0.39198,-0.214628,-0.157961,0.213775,-0.481331,-0.157961,0.329906,-0.419257,-0.157961,-0.019061,-0.384887,-0.157961,0.009146,-0.419257,-0.157961,0.043516,-0.447464,-0.157961,0.379073,-0.17208,-0.157961,0.329906,-0.098497,-0.15796,0.256323,-0.04933,-0.15796,0.009146,-0.098497,-0.15796,-0.019061,-0.384887,-0.157961,0.379073,-0.17208,-0.157961,-0.052927,-0.303126,-0.157961,-0.04002,-0.17208,-0.157961,-0.052927,-0.214628,-0.157961,0.198957,-0.110919,-0.271932,0.198957,-0.110919,-0.271932,0.227257,-0.119503,-0.271932,0.253338,-0.133444,-0.271932,0.294959,-0.175065,-0.271932,0.3089,-0.201146,-0.271932,0.276198,-0.152205,-0.271932,0.253338,-0.133444,-0.271932,0.3089,-0.201146,-0.271932,0.317485,-0.288308,-0.271932,0.3089,-0.316607,-0.271932,0.320383,-0.258877,-0.271932,0.294959,-0.342689,-0.271932,0.253338,-0.38431,-0.271932,0.227257,-0.398251,-0.271932,0.276198,-0.365549,-0.271932,0.169526,-0.10802,-0.271932,0.085715,-0.133444,-0.271932,0.111796,-0.119503,-0.271932,0.140096,-0.406835,-0.271932,0.169526,-0.409734,-0.271932,0.140096,-0.406835,-0.271932,0.111796,-0.398251,-0.271932,0.085715,-0.38431,-0.271932,0.044093,-0.342689,-0.271932,0.140096,-0.406835,-0.271932,0.062854,-0.365549,-0.271932,0.044093,-0.342689,-0.271932,0.030153,-0.316607,-0.271932,0.021568,-0.288308,-0.271932,0.199673,-0.10732,-0.34201,0.213775,-0.036423,-0.338823,0.228661,-0.116113,-0.34201,0.044093,-0.175065,-0.271932,0.018669,-0.258877,-0.271932,0.030153,-0.201146,-0.271932,0.044093,-0.175065,-0.271932,0.062854,-0.152205,-0.271932,0.085715,-0.133444,-0.271932,0.140096,-0.110918,-0.271932,0.169526,-0.10802,-0.271932,0.111796,-0.119503,-0.271932,0.253338,-0.133444,-0.271932,0.317485,-0.229446,-0.271932,0.198957,-0.110919,-0.271932,0.3089,-0.201146,-0.271932,0.253338,-0.133444,-0.271932,0.276198,-0.152205,-0.271932,0.021568,-0.288308,-0.271932,0.320383,-0.258877,-0.271932,0.044093,-0.175065,-0.271932,0.169526,-0.10802,-0.271932,0.198957,-0.110919,-0.271932,0.140096,-0.406835,-0.271932,0.044093,-0.342689,-0.271932,0.227257,-0.398251,-0.271932,0.294959,-0.342689,-0.271932,0.276198,-0.365549,-0.271932,0.018669,-0.258877,-0.271932,0.021568,-0.229446,-0.271932,0.030153,-0.201146,-0.271932,0.227257,-0.398251,-0.271932,0.198957,-0.406835,-0.271932,0.169526,-0.409734,-0.271932,0.169526,-0.104351,-0.34201,0.169526,-0.032065,-0.338823,0.199673,-0.10732,-0.34201,0.044093,-0.175065,-0.271932,0.021568,-0.288308,-0.271932,0.018669,-0.258877,-0.271932,0.227257,-0.398251,-0.271932,0.140096,-0.406835,-0.271932,0.085715,-0.38431,-0.271932,0.062854,-0.365549,-0.271932,0.169526,-0.10802,-0.271932,0.044093,-0.175065,-0.271932,0.085715,-0.133444,-0.271932,0.255377,-0.130393,-0.34201,0.228661,-0.116113,-0.34201,0.295536,-0.07029,-0.338823,0.255377,-0.130393,-0.34201,0.295536,-0.07029,-0.338823,0.278793,-0.14961,-0.34201,0.29801,-0.173027,-0.34201,0.278793,-0.14961,-0.34201,0.358113,-0.132867,-0.338823,0.31229,-0.199742,-0.34201,0.29801,-0.173027,-0.34201,0.379073,-0.17208,-0.338823,0.321084,-0.22873,-0.34201,0.31229,-0.199742,-0.34201,0.39198,-0.214628,-0.338823,0.324053,-0.258877,-0.34201,0.324053,-0.258877,-0.34201,0.396338,-0.258877,-0.338823,0.321084,-0.289023,-0.34201,0.31229,-0.318012,-0.34201,0.29801,-0.344727,-0.34201,0.31229,-0.318012,-0.34201,0.358113,-0.384887,-0.338823,0.278793,-0.368143,-0.34201,0.29801,-0.344727,-0.34201,0.329906,-0.419257,-0.338823,0.255377,-0.387361,-0.34201,0.255377,-0.387361,-0.34201,0.228661,-0.401641,-0.34201,0.256323,-0.468424,-0.338823,0.199673,-0.410434,-0.34201,0.199673,-0.410434,-0.34201,0.213775,-0.481331,-0.338823,0.169526,-0.413403,-0.34201,0.13938,-0.410434,-0.34201,0.13938,-0.410434,-0.34201,0.125278,-0.481331,-0.338823,0.110392,-0.401641,-0.34201,0.110392,-0.401641,-0.34201,0.083676,-0.387361,-0.34201,0.06026,-0.368143,-0.34201,0.009146,-0.419257,-0.338823,0.041042,-0.344727,-0.34201,0.041042,-0.344727,-0.34201,-0.019061,-0.384887,-0.338823,0.026763,-0.318011,-0.34201,0.026763,-0.318011,-0.34201,-0.04002,-0.345674,-0.338823,0.017969,-0.289023,-0.34201,0.017969,-0.289023,-0.34201,-0.052927,-0.303126,-0.338823,0.015,-0.258877,-0.34201,0.017969,-0.22873,-0.34201,0.017969,-0.22873,-0.34201,0.026763,-0.199742,-0.34201,0.041043,-0.173027,-0.34201,-0.019061,-0.132867,-0.338823,0.06026,-0.14961,-0.34201,0.06026,-0.14961,-0.34201,0.009146,-0.098497,-0.338823,0.083676,-0.130393,-0.34201,0.083676,-0.130393,-0.34201,0.043517,-0.07029,-0.338823,0.110392,-0.116113,-0.34201,0.13938,-0.10732,-0.34201,0.110392,-0.116113,-0.34201,0.08273,-0.04933,-0.338823,0.13938,-0.10732,-0.34201,0.198957,-0.110919,-0.271932,0.169526,-0.10802,-0.271932,0.199673,-0.10732,-0.34201,0.198957,-0.110919,-0.271932,0.253338,-0.133444,-0.271932,0.227257,-0.119503,-0.271932,0.255377,-0.130393,-0.34201,0.276198,-0.152205,-0.271932,0.253338,-0.133444,-0.271932,0.278793,-0.14961,-0.34201,0.276198,-0.152205,-0.271932,0.278793,-0.14961,-0.34201,0.294959,-0.175065,-0.271932,0.3089,-0.201146,-0.271932,0.294959,-0.175065,-0.271932,0.31229,-0.199742,-0.34201,0.317485,-0.229446,-0.271932,0.3089,-0.201146,-0.271932,0.321084,-0.22873,-0.34201,0.317485,-0.229446,-0.271932,0.321084,-0.22873,-0.34201,0.320383,-0.258877,-0.271932,0.317485,-0.288308,-0.271932,0.320383,-0.258877,-0.271932,0.321084,-0.289023,-0.34201,0.317485,-0.288308,-0.271932,0.321084,-0.289023,-0.34201,0.3089,-0.316607,-0.271932,0.294959,-0.342689,-0.271932,0.3089,-0.316607,-0.271932,0.29801,-0.344727,-0.34201,0.276198,-0.365549,-0.271932,0.294959,-0.342689,-0.271932,0.278793,-0.368143,-0.34201,0.276198,-0.365549,-0.271932,0.278793,-0.368143,-0.34201,0.253338,-0.38431,-0.271932,0.253338,-0.38431,-0.271932,0.255377,-0.387361,-0.34201,0.227257,-0.398251,-0.271932,0.227257,-0.398251,-0.271932,0.228661,-0.401641,-0.34201,0.198957,-0.406835,-0.271932,0.198957,-0.406835,-0.271932,0.199673,-0.410434,-0.34201,0.169526,-0.409734,-0.271932,0.140096,-0.406835,-0.271932,0.169526,-0.409734,-0.271932,0.13938,-0.410434,-0.34201,0.140096,-0.406835,-0.271932,0.13938,-0.410434,-0.34201,0.111796,-0.398251,-0.271932,0.111796,-0.398251,-0.271932,0.085715,-0.38431,-0.271932,0.083676,-0.387361,-0.34201,0.062854,-0.365549,-0.271932,0.062854,-0.365549,-0.271932,0.06026,-0.368143,-0.34201,0.044093,-0.342689,-0.271932,0.044093,-0.342689,-0.271932,0.041042,-0.344727,-0.34201,0.030153,-0.316607,-0.271932,0.021568,-0.288308,-0.271932,0.030153,-0.316607,-0.271932,0.017969,-0.289023,-0.34201,0.021568,-0.288308,-0.271932,0.017969,-0.289023,-0.34201,0.018669,-0.258877,-0.271932,0.018669,-0.258877,-0.271932,0.021568,-0.229446,-0.271932,0.017969,-0.22873,-0.34201,0.030153,-0.201146,-0.271932,0.030153,-0.201146,-0.271932,0.026763,-0.199742,-0.34201,0.044093,-0.175065,-0.271932,0.044093,-0.175065,-0.271932,0.041043,-0.173027,-0.34201,0.062854,-0.152205,-0.271932,0.062854,-0.152205,-0.271932,0.085715,-0.133444,-0.271932,0.140096,-0.110918,-0.271932,0.13938,-0.10732,-0.34201,0.169526,-0.10802,-0.271932,0.111796,-0.119503,-0.271932,0.169526,-0.032065,-0.338823,0.169526,-0.032065,-0.15796,0.213775,-0.036423,-0.15796,0.213775,-0.036423,-0.15796,0.256323,-0.04933,-0.15796,0.256323,-0.04933,-0.338823,0.256323,-0.04933,-0.338823,0.256323,-0.04933,-0.15796,0.295536,-0.07029,-0.15796,0.295536,-0.07029,-0.338823,0.295536,-0.07029,-0.15796,0.329906,-0.098497,-0.15796,0.329906,-0.098497,-0.338823,0.329906,-0.098497,-0.15796,0.358113,-0.132867,-0.157961,0.358113,-0.132867,-0.157961,0.379073,-0.17208,-0.157961,0.379073,-0.17208,-0.338823,0.379073,-0.17208,-0.157961,0.39198,-0.214628,-0.157961,0.39198,-0.214628,-0.338823,0.39198,-0.214628,-0.157961,0.396338,-0.258877,-0.157961,0.396338,-0.258877,-0.338823,0.396338,-0.258877,-0.157961,0.39198,-0.303126,-0.157961,0.39198,-0.303126,-0.338823,0.39198,-0.303126,-0.157961,0.379073,-0.345674,-0.157961,0.379073,-0.345674,-0.338823,0.379073,-0.345674,-0.157961,0.358113,-0.384887,-0.157961,0.358113,-0.384887,-0.338823,0.358113,-0.384887,-0.157961,0.329906,-0.419257,-0.157961,0.329906,-0.419257,-0.338823,0.329906,-0.419257,-0.157961,0.295536,-0.447464,-0.157961,0.295536,-0.447464,-0.338823,0.295536,-0.447464,-0.338823,0.295536,-0.447464,-0.157961,0.256323,-0.468424,-0.157961,0.256323,-0.468424,-0.157961,0.213775,-0.481331,-0.157961,0.213775,-0.481331,-0.338823,0.213775,-0.481331,-0.157961,0.169526,-0.485689,-0.157961,0.169526,-0.485689,-0.338823,0.169526,-0.485689,-0.157961,0.125278,-0.481331,-0.157961,0.125278,-0.481331,-0.338823,0.125278,-0.481331,-0.338823,0.125278,-0.481331,-0.157961,0.082729,-0.468424,-0.157961,0.082729,-0.468424,-0.157961,0.043516,-0.447464,-0.157961,0.043516,-0.447464,-0.338823,0.043516,-0.447464,-0.338823,0.043516,-0.447464,-0.157961,0.009146,-0.419257,-0.157961,0.009146,-0.419257,-0.157961,-0.019061,-0.384887,-0.157961,-0.019061,-0.384887,-0.338823,-0.019061,-0.384887,-0.338823,-0.019061,-0.384887,-0.157961,-0.04002,-0.345674,-0.157961,-0.04002,-0.345674,-0.157961,-0.052927,-0.303126,-0.157961,-0.052927,-0.303126,-0.338823,-0.052927,-0.303126,-0.157961,-0.057285,-0.258877,-0.157961,-0.057285,-0.258877,-0.338823,-0.057285,-0.258877,-0.157961,-0.052927,-0.214628,-0.157961,-0.052927,-0.214628,-0.338823,-0.052927,-0.214628,-0.338823,-0.052927,-0.214628,-0.157961,-0.04002,-0.17208,-0.157961,-0.04002,-0.17208,-0.338823,-0.04002,-0.17208,-0.157961,-0.019061,-0.132867,-0.157961,-0.019061,-0.132867,-0.157961,0.009146,-0.098497,-0.15796,0.009146,-0.098497,-0.338823,0.009146,-0.098497,-0.15796,0.043517,-0.07029,-0.15796,0.043517,-0.07029,-0.338823,0.043517,-0.07029,-0.15796,0.08273,-0.04933,-0.15796,0.08273,-0.04933,-0.338823,0.125278,-0.036423,-0.15796,0.169526,-0.032065,-0.15796,0.169526,-0.032065,-0.338823,0.08273,-0.04933,-0.15796,0.125278,-0.036423,-0.15796,0.125278,-0.036423,-0.338823,0.213775,-0.036423,-0.338823,0.213775,-0.036423,-0.338823,0.295536,-0.07029,-0.338823,0.329906,-0.098497,-0.338823,0.358113,-0.132867,-0.338823,0.358113,-0.132867,-0.338823,0.379073,-0.17208,-0.338823,0.39198,-0.214628,-0.338823,0.396338,-0.258877,-0.338823,0.39198,-0.303126,-0.338823,0.379073,-0.345674,-0.338823,0.358113,-0.384887,-0.338823,0.329906,-0.419257,-0.338823,0.256323,-0.468424,-0.338823,0.256323,-0.468424,-0.338823,0.213775,-0.481331,-0.338823,0.169526,-0.485689,-0.338823,0.082729,-0.468424,-0.338823,0.082729,-0.468424,-0.338823,0.009146,-0.419257,-0.338823,0.009146,-0.419257,-0.338823,-0.04002,-0.345674,-0.338823,-0.04002,-0.345674,-0.338823,-0.052927,-0.303126,-0.338823,-0.057285,-0.258877,-0.338823,-0.04002,-0.17208,-0.338823,-0.019061,-0.132867,-0.338823,-0.019061,-0.132867,-0.338823,0.009146,-0.098497,-0.338823,0.043517,-0.07029,-0.338823,0.08273,-0.04933,-0.338823,0.125278,-0.036423,-0.338823],
"indices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,24,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,194,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,167,169,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,27,29,318,319,320,321,322,323,324,325,326,327,328,329,330,42,44,331,45,47,332,48,50,333,334,335,336,337,338,339,340,341,342,63,65,343,344,345,346,347,348,349,350,351,352,75,77,353,354,355,356,81,83,357,84,86,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,25,24,374,375,376,373,24,103,377,378,379,380,381,382,383,384,385,386,122,124,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,170,172,421,422,423,424,425,426,427,428,429,430,431,432,433,185,187,434,435,436,437,191,193,438,439,440,441,442,443,444,445,446,196,206,194,447,448,449,450,451,452,453,454,455,456,217,219,457,458,459,460,223,225,461,226,228,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,167,478,479,480,481,482,483,484,167,244,478,485,486,487,488,489,490,491,263,265,492,493,494,495,496,497,498,499,500,501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,522,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,548,561,562,563,564,565,566,567,568,569,570,571,572,573,534,574,548,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624,625,626,627,628,629,630,631,620,632,598,633,634,625,558,533,517,635,636,637,532,518,533,638,519,521,518,517,533,574,522,524,639,525,527,640,528,530,641,531,533,574,534,522,642,536,538,643,539,541,544,559,558,644,545,547,558,542,544,561,548,550,645,551,553,646,554,556,647,557,559,648,560,561,649,562,564,650,565,567,651,568,570,560,534,548,652,653,654,655,656,657,658,659,660,661,662,663,664,665,666,667,590,592,668,669,670,632,596,598,634,633,671,672,602,604,673,605,607,656,655,622,674,675,676,677,678,679,680,620,622,681,623,625,682,626,628,683,629,631,621,620,598,624,633,625,542,558,517,684,685,686,687,688,689,690,691,692,693,694,695,696,697,698,699,700,701,702,703,704,705,706,707,708,709,710,711,712,713,714,715,716,717,718,719,720,721,722,723,724,725,726,727,728,729,730,731,732,733,734,735,736,737,738,739,740,741,742,743,744,745,746,747,748,749,750,751,752,753,754,755,756,757,758,759,760,761,762,763,764,765,766,767,768,769,770,771,772,773,774,775,776,777,778,779,780,781,782,783,784,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,803,804,805,806,807,808,809,810,811,812,813,814,815,816,817,818,819,820,821,822,823,824,825,826,827,828,829,830,831,832,833,834,835,836,837,838,839,840,841,842,843,844,845,846,847,848,849,850,851,852,853,854,855,856,857,858,859,860,861,862,863,864,865,866,867,868,869,870,871,872,873,874,875,876,877,878,879,880,881,882,883,884,885,886,887,888,889,689,890,891,892,893,894,895,896,897,898,899,900,901,902,903,904,905,906,907,908,909,910,911,912,913,914,915,916,917,918,919,920,899,901,921,922,923,924,925,687,926,927,928,929,930,931,932,933,934,935,936,937,938,939,940,941,942,943,688,944,689,945,946,947,927,948,928,926,949,937,950,899,951,952,953,687,937,950,951,954,955,956,957,958,959,960,961,962,963,964,965,966,967,968,969,970,971,972,973,974,975,976,977,978,979,980,981,982,983,984,985,986,987,988,989,990,991,992,993,966,994,995,996,997,998,999,1000,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018,1019,1012,1020,1021,1022,1023,1024,1025,995,1009,1008,1012,1026,1027,1028,1029,1030,1031,1032,1033,1034,1035,1036,1037,1038,1039,1040,1041,1042,1030,1043,1044,1045,1046,1047,1048,1049,705,707,1050,708,710,1051,711,713,1052,1053,1054,1055,1056,1057,1058,1059,1060,1061,1062,1063,1064,1065,1066,1067,1068,1069,1070,1071,1072,1073,1074,1075,1076,1077,1078,1079,1080,1081,1082,1083,1084,1085,1086,1087,1088,1089,1090,1091,1092,1093,1094,756,758,1095,1096,1097,1098,1099,1100,1101,765,767,1102,1103,1104,1105,1106,1107,1108,774,776,1109,1110,1111,1112,780,782,1113,783,785,1114,786,788,1115,1116,1117,1118,792,794,1119,1120,1121,1122,798,800,1123,1124,1125,1126,1127,1128,1129,807,809,1130,1131,1132,1133,1134,1135,1136,1137,1138,1139,819,821,1140,822,824,1141,1142,1143,1144,1145,1146,1147,1148,1149,1150,1151,1152,1153,1154,1155,1156,1157,1158,1159,1160,1161,1162,1163,1164,1165,1166,1167,1168,1169,1170,1171,1172,1173,1174,1175,1176,1177,861,863,1178,1179,1180,1181,1182,1183,1184,1185,1186,1187,1188,1189,1190,1191,1192,1193,1194,1195,1196,1197,1198,1199,1200,1201,1202,1203,1204,1205,1206,1207,1208,1209,1210,1211,1212,1213,1214,1215,1216,1217,1218,1219,1220,1221,1222,1223,1224,1225,1226,1227,1228,1229,1230,1231,1232,1233,1234,1235,1236,1237,1238,1239,1240,1241,1242,1243,1244,1245,1246,1247,1248,1249,1250,1251,1252,1253,1254,1255,1256,1257,1258,1259,1260,1261,1262,1263,1264,1265,1266,1267,1268,1269,1270,1271,1272,1273,1274,1275,1276,1277,1278,1279,1280,1281,1282,1283,1284,1285,1286,1287,1288,1289,1290,1291,1292,1293,1294,1295,1199,1201,1296,1202,1204,1297,1205,1207,1298,1208,1210,1299,1211,1213,1300,1214,1216,1301,1217,1219,1302,1220,1222,1303,1223,1225,1304,1226,1228,1305,1229,1231,1306,1232,1234,1307,1235,1237,1308,1238,1240,1309,1241,1243,1310,1244,1246,1311,1247,1249,1312,1250,1252,1313,1253,1255,1314,1256,1258,1315,1259,1261,1316,1262,1264,1317,1265,1267,1318,1268,1270,1319,1271,1273,1320,1274,1276,1321,1277,1279,1322,1280,1282,1323,1283,1285,1324,1286,1288,1325,1292,1294,1326,1289,1291,1327,1328,1329,1330,1331,1332,1333,1334,1335,1336,1337,1338,1339,1340,1341,1342,1343,1344,1345,1346,1335,1347,1348,1349,1350,1351,1352,1353,1354,1355,1356,1357,1358,1359,1360,1361,1362,1363,1364,1365,1366,1367,1368,1369,1370,1371,1361,1372,1373,1374,1375,1376,1377,1378,1379,1380,1381,1382,1383,1384,1345,1372,1361,1385,1386,1387,1388,1389,1390,1391,1392,1393,1394,1395,1396,1397,1398,1399,1400,1401,1402,1403,1404,1405,1406,1407,1408,1409,1410,1411,1412,1413,1414,1415,1416,1417,1418,1419,1420,1421,1422,1423,1424,1425,1426,1427,1428,1429,1430,1431,1432,1433,1434,1435,1436,1437,1438,1439,1440,1441,1432,1431,1442,1435,1410,1409,1443,1444,1445,1369,1355,1327,1327,1329,1342,1446,1330,1332,1346,1333,1335,1329,1343,1342,1447,1336,1338,1448,1339,1341,1449,1342,1344,1450,1345,1335,1451,1347,1349,1452,1350,1352,1369,1368,1353,1453,1356,1358,1353,1355,1369,1371,1359,1361,1454,1362,1364,1455,1365,1367,1456,1368,1370,1457,1371,1372,1458,1373,1375,1459,1376,1378,1460,1379,1381,1346,1345,1361,1461,1462,1463,1464,1388,1390,1465,1391,1393,1466,1467,1468,1469,1470,1471,1472,1400,1402,1473,1474,1475,1476,1442,1477,1478,1409,1411,1479,1480,1481,1482,1483,1484,1485,1486,1487,1488,1489,1490,1491,1427,1429,1487,1430,1432,1492,1433,1435,1493,1494,1495,1496,1497,1498,1476,1432,1442,1492,1435,1409,1499,1500,1501,1342,1369,1327,1502,1503,1504,1505,1506,1507,1508,1509,1510,1511,1512,1513,1514,1515,1516,1517,1518,1519,1520,1521,1522,1523,1524,1525,1526,1527,1524,1528,1529,1530,1531,1505,1507,1532,1508,1510,1533,1534,1535,1536,1514,1516,1537,1538,1539,1540,1541,1542,1543,1544,1545,1546,1547,1548,1549,1550,1551,1552,1553,1554,1555,1556,1557,1558,1559,1560,1561,1562,1563,1564,1565,1566,1567,1568,1569,1570,1571,1572,1573,1574,1575,1568,1567,1576,1577,1578,1579,1580,1581,1582,1583,1584,1585,1586,1587,1588,1589,1590,1591,1592,1580,1582,1593,1594,1595,1596,1597,1598,1599,1600,1601,1602,1603,1604,1605,1606,1607,1608,1609,1610,1611,1523,1525,1523,1526,1524,1612,1613,1614,1615,1616,1612,1617,1618,1619,1618,1620,1621,1622,1623,1624,1625,1626,1624,1625,1623,1622,1627,1628,1629,1630,1629,1628,1631,1632,1633,1634,1632,1631,1635,1636,1637,1636,1635,1638,1637,1636,1639,1630,1640,1616,1634,1641,1621,1639,1638,1626,1639,1625,1642,1614,1613,1617,1643,1633,1627,1644,1622,1645,1646,1647,1613,1645,1624,1618,1624,1626,1620,1627,1648,1649,1635,1650,1633,1638,1635,1632,1647,1645,1617,1633,1650,1648,1638,1634,1620,1651,1652,1653,1654,1655,1656,1657,1658,1659,1658,1660,1661,1662,1659,1661,1663,1664,1665,1666,1667,1665,1668,1669,1670,1670,1669,1671,1672,1673,1674,1675,1673,1672,1676,1672,1677,1678,1679,1680,1679,1678,1681,1682,1671,1656,1675,1676,1661,1683,1661,1676,1684,1681,1667,1652,1663,1685,1686,1680,1668,1687,1654,1653,1685,1665,1658,1665,1667,1660,1673,1678,1686,1681,1678,1673,1653,1685,1657,1686,1688,1689,1681,1675,1660,1690,1691,1692,1693,1694,1695,1696,1697,1698,1699,1700,1701,1701,1697,1702,1697,1695,1703,1704,1705,1706,1702,1707,1692,1708,1707,1709,1706,1692,1708,1706,1708,1710,1711,1706,1710,1708,1712,1710,1713,1714,1715,1716,1710,1717,1712,1718,1717,1712,1709,1718,1709,1707,1719,1720,1717,1721,1703,1722,1719,1718,1709,1723,1723,1709,1724,1725,1726,1727,1727,1724,1728,1729,1726,1725,1730,1731,1732,1733,1734,1735,1728,1722,1694,1728,1736,1735,1737,1738,1735,1739,1736,1740,1703,1695,1722,1722,1695,1694,1741,1720,1721,1696,1740,1693,1742,1740,1696,1693,1695,1697,1696,1693,1697,1698,1697,1700,1700,1697,1701,1691,1701,1692,1743,1692,1705,1705,1692,1706,1692,1707,1708,1702,1703,1707,1716,1744,1710,1710,1712,1717,1720,1716,1717,1707,1703,1719,1721,1717,1718,1715,1721,1718,1714,1721,1715,1718,1723,1715,1709,1719,1724,1727,1723,1724,1719,1722,1724,1715,1723,1726,1745,1715,1726,1726,1723,1727,1729,1745,1726,1730,1727,1728,1724,1722,1728,1746,1729,1725,1725,1730,1747,1735,1730,1728,1730,1735,1731,1736,1728,1694,1734,1731,1735,1737,1736,1739,1693,1736,1694,1740,1736,1693,1748,1749,1750,1751,1752,1753,1754,1755,1756,1757,1758,1756,1758,1759,1760,1759,1761,1760,1761,1762,1750,1762,1748,1750,1749,1751,1750,1750,1753,1763,1764,1760,1750,1765,1766,1767,1755,1757,1756,1752,1754,1753,1759,1758,1757,1768,1756,1760,1753,1756,1769,1750,1751,1753,1753,1754,1756,1756,1758,1760,1760,1761,1750,1770,1750,1763,1763,1753,1771,1765,1772,1760,1764,1765,1760,1773,1764,1750,1773,1750,1766,1768,1769,1756,1766,1750,1767,1767,1750,1770,1772,1768,1760,1771,1753,1769,1774,1775,1776,1775,1777,1778,1777,1779,1780,1779,1781,1782,1783,1784,1785,1786,1787,1788,1789,1790,1791,1792,1791,1793,1794,1793,1795,1796,1797,1798,1799,1800,1801,1802,1774,1803,1804,1805,1806,1807,1797,1796,1808,1807,1809,1798,1810,1811,1812,1795,1808,1810,1802,1813,1814,1785,1790,1806,1805,1815,1816,1804,1817,1801,1800,1816,1795,1818,1819,1809,1820,1821,1777,1822,1527,1785,1525,1823,1802,1824,1825,1778,1826,1827,1789,1828,1829,1793,1830,1818,1791,1831,1830,1813,1832,1833,1810,1834,1824,1774,1825,1835,1814,1829,1836,1811,1833,1837,1782,1838,1839,1790,1823,1831,1840,1821,1841,1842,1819,1843,1844,1837,1845,1792,1846,1828,1847,1788,1834,1796,1845,1820,1803,1848,1832,1780,1839,1826,1776,1827,1848,1775,1835,1822,1812,1841,1849,1850,1843,1787,1851,1852,1853,1794,1849,1846,1854,1612,1614,1854,1615,1612,1855,1617,1619,1619,1618,1621,1645,1622,1624,1623,1625,1624,1642,1625,1622,1856,1627,1629,1640,1630,1628,1643,1631,1633,1641,1634,1631,1650,1635,1637,1639,1636,1638,1857,1637,1639,1615,1630,1616,1620,1634,1621,1625,1639,1626,1857,1639,1642,1855,1614,1617,1856,1643,1627,1647,1644,1645,1612,1646,1613,1617,1645,1618,1618,1624,1620,1628,1627,1649,1632,1635,1633,1634,1638,1632,1613,1647,1617,1627,1633,1648,1626,1638,1620,1654,1651,1653,1651,1654,1656,1662,1657,1659,1659,1658,1661,1683,1662,1661,1685,1663,1665,1664,1666,1665,1688,1668,1670,1682,1670,1671,1677,1672,1674,1676,1675,1672,1858,1676,1677,1686,1678,1680,1684,1679,1681,1655,1682,1656,1660,1675,1661,1858,1683,1676,1666,1684,1667,1653,1652,1685,1688,1686,1668,1859,1687,1653,1657,1685,1658,1658,1665,1660,1674,1673,1686,1675,1681,1673,1859,1653,1657,1674,1686,1689,1667,1681,1660,1743,1690,1692,1692,1701,1702,1702,1697,1703,1711,1704,1706,1712,1708,1709,1745,1713,1715,1730,1725,1727,1747,1730,1732,1738,1733,1735,1736,1737,1735,1860,1739,1740,1861,1742,1696,1770,1763,1767,1768,1772,1771,1771,1769,1768,1765,1763,1772,1773,1766,1764,1748,1752,1749,1766,1765,1764,1772,1763,1771,1763,1765,1767,1748,1762,1761,1757,1752,1761,1755,1752,1757,1755,1754,1752,1759,1757,1761,1752,1751,1749,1752,1748,1761,1803,1774,1776,1776,1775,1778,1778,1777,1780,1780,1779,1782,1814,1783,1785,1847,1786,1788,1792,1789,1791,1794,1792,1793,1812,1794,1795,1844,1796,1798,1813,1802,1803,1817,1804,1806,1809,1807,1796,1840,1808,1809,1844,1798,1811,1840,1812,1808,1811,1810,1813,1789,1814,1790,1862,1816,1817,1862,1801,1816,1842,1795,1819,1840,1809,1821,1779,1777,1527,1790,1785,1823,1774,1802,1825,1776,1778,1827,1814,1789,1829,1795,1793,1818,1793,1791,1830,1811,1813,1833,1802,1810,1824,1775,1774,1835,1783,1814,1836,1844,1811,1837,1780,1782,1839,1791,1790,1831,1812,1840,1841,1850,1842,1843,1796,1844,1845,1789,1792,1828,1810,1847,1834,1809,1796,1820,1813,1803,1832,1778,1780,1826,1803,1776,1848,1777,1775,1822,1794,1812,1849,1786,1850,1787,1863,1851,1853,1792,1794,1846,1864,1865,1866,1867,1868,1869,1870,1871,1872,1873,1874,1875,1876,1877,1878,1879,1880,1881,1882,1883,1884,1885,1886,1887,1888,1889,1890,1891,1892,1893,1894,1895,1896,1897,1898,1899,1900,1901,1902,1903,1904,1905,1906,1907,1908,1909,1910,1911,1912,1913,1914,1915,1916,1917,1918,1919,1920,1921,1922,1923,1924,1925,1926,1927,1864,1866,1928,1867,1869,1929,1870,1872,1930,1873,1875,1931,1876,1878,1932,1879,1881,1933,1882,1884,1934,1885,1887,1935,1888,1890,1936,1891,1893,1937,1894,1896,1938,1897,1899,1939,1900,1902,1940,1903,1905,1941,1906,1908,1942,1909,1911,1943,1912,1914,1944,1915,1917,1945,1918,1920,1946,1921,1923,1947,1924,1926,1948,1949,1950,1951,1952,1953,1954,1955,1956,1957,1958,1959,1960,1961,1962,1963,1964,1965,1965,1966,1948,1967,1968,1969,1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,1948,1981,1949,1980,1981,1982,1949,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1967,1950,1968,1974,1970,1975,1973,1948,1974,1979,1995,1980,1949,1986,1988,1970,1972,1975,1968,1988,1996,1973,1979,1948,1979,1973,1997,1949,1988,1968,1980,1949,1948,1965,1948,1950,1968,1950,1949,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,1952,2009,2001,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040,2041,2042,2043,1952,1951,2007,2044,2045,2046,1953,1952,2047,2048,2049,2050,1952,2010,2047,2051,2052,2053,1951,2054,2055,2056,2057,2058,1998,2000,2059,1953,2056,2058,2060,2061,2062,2058,2063,1953,2029,2064,2060,2065,2066,2067,2068,2069,2070,2071,2072,2073,2074,2075,2076,2077,2078,2079,2080,2081,2082,2083,2084,2085,2086,2087,2088,2089,2090,2091,2092,2093,2094,2095,2096,2097,2098,2099,2100,2101,2102,2103,2104,2105,2106,2107,2108,2109,2110,2111,2112,2113,2114,2115,2116,2117,2118,2119,2120,2121,2122,2123,2124,2125,2126,2127,2128,2129,2130,2131,2132,2133,2134,2135,2136,2137,2138,2139,2140,2141,2142,2143,2144,2145,2146,2147,2148,2149,2150,2151,2152,2153,2154,2155,2156,2157,2158,2159,2160,2161,2065,2067,2162,2068,2070,2163,2071,2073,2164,2074,2076,2165,2077,2079,2166,2080,2082,2167,2083,2085,2168,2086,2088,2169,2089,2091,2170,2092,2094,2171,2095,2097,2172,2098,2100,2173,2101,2103,2174,2104,2106,2175,2107,2109,2176,2110,2112,2177,2113,2115,2178,2116,2118,2179,2119,2121,2180,2122,2124,2181,2125,2127,2182,2128,2130,2183,2131,2133,2184,2134,2136,2185,2137,2139,2186,2140,2142,2187,2143,2145,2188,2146,2148,2189,2149,2151,2190,2152,2154,2191,2155,2157,2192,2158,2160,2193,2194,2195,2196,2197,2198,2199,2200,2193,2195,2201,2202,2203,2204,2205,2206,2207,2208,2209,2210,2211,2212,2213,2214,2214,2215,2216,2216,2217,2218,2219,2220,2221,2222,2223,2224,2225,2226,2227,2207,2228,2208,2229,2230,2231,2232,2233,2234,2235,2236,2237,2200,2225,2227,2201,2194,2238,2239,2193,2207,2239,2240,2193,2201,2195,2194,2241,2199,2193,2242,2243,2244,2245,2246,2247,2228,2207,2193,2195,2228,2193,2194,2227,2245,2248,2249,2250,2227,2194,2200,2193,2200,2194,2251,2197,2252,2253,2254,2255,2256,2257,2258,2259,2260,2261,2262,2263,2264,2265,2266,2267,2268,2269,2270,2271,2272,2273,2274,2275,2276,2277,2278,2279,2280,2281,2282,2283,2284,2285,2286,2280,2282,2287,2288,2289,2290,2291,2292,2293,2294,2295,2296,2284,2297,2290,2286,2291,2298,2299,2300,2301,2302,2303,2304,2305,2306,2280,2286,2290,2275,2273,2276,2251,2198,2197,2197,2290,2252,2196,2306,2197,2307,2308,2309,2198,2310,2311,2312,2313,2314,2315,2316,2317,2318,2319,2320,2321,2322,2323,2324,2325,2326,2327,2328,2329,2330,2331,2332,2333,2334,2335,2336,2337,2338,2339,2340,2341,2342,2343,2344,2345,2346,2347,2348,2349,2350,2351,2352,2353,2354,2355,2356,2357,2358,2359,2360,2361,2362,2363,2364,2365,2366,2367,2368,2369,2370,2371,2372,2373,2374,2375,2376,2377,2378,2379,2380,2381,2382,2383,2384,2385,2386,2387,2388,2389,2390,2391,2392,2393,2394,2395,2396,2397,2398,2399,2400,2401,2402,2403,2404,2405,2406,2407,2408,2409,2410,2411,2315,2317,2412,2318,2320,2413,2321,2323,2414,2324,2326,2415,2327,2329,2416,2330,2332,2417,2333,2335,2418,2336,2338,2419,2339,2341,2420,2342,2344,2421,2345,2347,2422,2348,2350,2423,2351,2353,2424,2354,2356,2425,2357,2359,2426,2360,2362,2427,2363,2365,2428,2366,2368,2429,2369,2371,2430,2372,2374,2431,2375,2377,2432,2378,2380,2433,2381,2383,2434,2384,2386,2435,2387,2389,2436,2390,2392,2437,2393,2395,2438,2396,2398,2439,2399,2401,2440,2402,2404,2441,2408,2410,2442,2405,2407,2443,2444,2445,2446,2447,2448,2449,2450,2451,2452,2453,2454,2455,2456,2457,2458,2459,2460,2461,2462,2463,2464,2465,2466,2467,2468,2469,2470,2471,2472,2473,2474,2475,2476,2477,2478,2479,2480,2481,2482,2483,2484,2485,2486,2487,2488,2489,2490,2491,2492,2493,2494,2495,2496,2497,2498,2499,2500,2501,2502,2503,2504,2505,2506,2507,2508,2509,2510,2511,2512,2513,2514,2515,2516,2517,2518,2519,2520,2521,2522,2523,2524,2525,2526,2527,2528,2529,2530,2531,2532,2533,2534,2535,2536,2537,2538,2539,2540,2541,2542,2543,2544,2545,2546,2547,2548,2549,2550,2551,2552,2553,2554,2555,2556,2557,2558,2559,2560,2561,2562,2563,2564,2565,2566,2567,2568,2569,2570,2571,2572,2573,2574,2575,2576,2577,2578,2579,2580,2581,2582,2583,2584,2585,2586,2587,2588,2589,2590,2591,2592,2593,2594,2595,2596,2597,2598,2599,2600,2601,2602,2603,2604,2605,2606,2607,2608,2609,2610,2611,2612,2613,2614,2615,2616,2617,2618,2619,2620,2621,2622,2623,2624,2625,2626,2627,2628,2629,2630,2631,2632,2633,2634,2635,2636,2637,2638,2639,2640,2641,2642,2643,2644,2645,2646,2647,2648,2649,2646,2650,2445,2651,2652,2653,2654,2655,2656,2642,2657,2643,2658,2659,2660,2661,2662,2663,2664,2665,2666,2667,2668,2669,2670,2671,2672,2673,2674,2675,2676,2677,2678,2679,2680,2681,2682,2683,2684,2685,2686,2687,2688,2689,2690,2691,2692,2693,2646,2445,2444,2694,2695,2696,2443,2697,2698,2699,2700,2701,2702,2703,2704,2642,2705,2657,2443,2706,2697,2443,2707,2444,2445,2706,2443,2708,2709,2710,2448,2447,2711,2712,2713,2714,2715,2716,2717,2448,2718,2719,2720,2721,2722,2723,2446,2721,2724,2725,2726,2727,2728,2729,2730,2725,2731,2732,2733,2734,2735,2736,2737,2738,2739,2740,2741,2742,2743,2744,2745,2746,2747,2748,2749,2750,2751,2752,2753,2754,2755,2756,2757,2758,2721,2446,2722,2759,2754,2760,2761,2762,2763,2446,2764,2765,2766,2767,2768,2769,2770,2771,2772,2773,2774,2775,2776,2777,2730,2759,2725,2778,2779,2780,2446,2723,2781,2782,2783,2784,2785,2786,2787,2788,2789,2790,2791,2792,2793,2794,2795,2796,2797,2798,2799,2800,2801,2802,2803,2470,2472,2804,2805,2806,2807,2476,2478,2808,2809,2810,2811,2812,2813,2814,2485,2487,2815,2488,2490,2816,2817,2818,2819,2820,2821,2822,2497,2499,2823,2824,2825,2826,2503,2505,2827,2506,2508,2828,2829,2830,2831,2832,2833,2834,2835,2836,2837,2838,2839,2840,2521,2523,2841,2524,2526,2842,2527,2529,2843,2844,2845,2846,2847,2848,2849,2850,2851,2852,2539,2541,2853,2854,2855,2856,2857,2858,2859,2548,2550,2860,2861,2862,2863,2864,2865,2866,2867,2868,2869,2870,2871,2872,2873,2874,2875,2876,2877,2878,2879,2880,2881,2882,2883,2884,2885,2886,2887,2888,2889,2890,2891,2892,2893,2894,2895,2896,2897,2898,2899,2900,2901,2902,2903,2904,2905,2906,2907,2908,2599,2601,2909,2910,2911,2912,2913,2914,2915,2916,2917,2918,2919,2920,2921,2922,2923,2924,2617,2619,2925,2926,2927,2928,2929,2930,2931,2932,2933,2934,2629,2631,2935,2632,2634,2936,2937,2938,2939,2638,2640,2940,2941,2942,2943,2944,2945,2946,2947,2948,2949,2950,2951,2952,2953,2954,2955,2956,2957,2958,2959,2960,2961,2962,2963,2964,2965,2966,2967,2968,2969,2970,2971,2972,2973,2974,2975,2976,2977,2978,2979,2980,2981,2982,2983,2984,2985,2986,2987,2988,2989,2990,2991,2992,2993,2994,2995,2996,2997,2998,2999,3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,3010,3011,3012,3013,3014,3015,3016,3017,3018,3019,3020,3021,3022,3023,3024,3025,3026,3027,3028,3029,3030,3031,3032,3033,3034,3035,3036,2940,2942,3037,2943,2945,3038,2946,2948,3039,2949,2951,3040,2952,2954,3041,2955,2957,3042,2958,2960,3043,2961,2963,3044,2964,2966,3045,2967,2969,3046,2970,2972,3047,2973,2975,3048,2976,2978,3049,2979,2981,3050,2982,2984,3051,2985,2987,3052,2988,2990,3053,2991,2993,3054,2994,2996,3055,2997,2999,3056,3000,3002,3057,3003,3005,3058,3006,3008,3059,3009,3011,3060,3012,3014,3061,3015,3017,3062,3018,3020,3063,3021,3023,3064,3024,3026,3065,3027,3029,3066,3033,3035,3067,3030,3032],
"texcoords":[0.293927,0.517279,0.315139,0.57518,0.197301,0.627629,0.16426,0.546442,0.18509,0.549028,0.172921,0.621006,0.073474,0.399352,0.086593,0.370781,0.13458,0.400233,0.234013,0.384953,0.299308,0.411094,0.291913,0.472602,0.735979,0.803473,0.628318,0.86422,0.678736,0.734753,0.675803,0.94917,0.658172,0.928595,0.742073,0.850039,0.688224,0.525808,0.728518,0.572267,0.724126,0.574665,0.260283,0.336716,0.160555,0.418298,0.13458,0.400233,0.70351,0.642221,0.678736,0.734753,0.67618,0.655614,0.124283,0.417131,0.127861,0.546406,0.073474,0.551144,0.124283,0.417131,0.14617,0.435533,0.141484,0.543088,0.227178,0.52855,0.197301,0.627629,0.172921,0.621006,0.224759,0.469913,0.227178,0.52855,0.18509,0.549028,0.291913,0.472602,0.293927,0.517279,0.227178,0.52855,0.82964,0.801812,0.735979,0.803473,0.678736,0.734753,0.724126,0.574665,0.728518,0.572267,0.734017,0.59653,0.14617,0.435533,0.124283,0.417131,0.13458,0.400233,0.193269,0.523836,0.180018,0.514648,0.176429,0.447754,0.160555,0.418298,0.176429,0.447754,0.180018,0.514648,0.16426,0.546442,0.159726,0.566458,0.141071,0.565101,0.14617,0.435533,0.180018,0.514648,0.16426,0.546442,0.193269,0.523836,0.18509,0.549028,0.16426,0.546442,0.234013,0.384953,0.224759,0.469913,0.193269,0.523836,0.260283,0.336716,0.234013,0.384953,0.176429,0.447754,0.260283,0.336716,0.317944,0.370846,0.299308,0.411094,0.742073,0.850039,0.735979,0.803473,0.82964,0.801812,0.658172,0.928595,0.628318,0.86422,0.735979,0.803473,0.811554,0.928173,0.733022,0.904977,0.742073,0.850039,0.794479,0.976548,0.711251,0.947172,0.733022,0.904977,0.679263,0.954827,0.675803,0.94917,0.733022,0.904977,0.242888,0.321718,0.13458,0.400233,0.086593,0.370781,0.236851,0.287693,0.249032,0.31557,0.242888,0.321718,0.317944,0.370846,0.260283,0.336716,0.242888,0.321718,0.67618,0.655614,0.615774,0.602702,0.663498,0.593864,0.729045,0.596644,0.734017,0.59653,0.675803,0.94917,0.643161,0.971357,0.62636,0.945892,0.658172,0.928595,0.62636,0.945892,0.598182,0.864196,0.67618,0.655614,0.677956,0.611859,0.70351,0.642221,0.224582,0.300126,0.200103,0.273844,0.212802,0.26192,0.615774,0.602702,0.67618,0.655614,0.635874,0.663705,0.679263,0.954827,0.646703,0.976548,0.643161,0.971357,0.628318,0.86422,0.598182,0.864196,0.640759,0.730972,0.224582,0.300126,0.086593,0.370781,0.200103,0.273844,0.680045,0.508544,0.688224,0.525808,0.676096,0.534164,0.676096,0.534164,0.663498,0.593864,0.615774,0.602702,0.073474,0.551144,0.127861,0.546406,0.141071,0.565101,0.127861,0.546406,0.141484,0.543088,0.141071,0.565101,0.678736,0.734753,0.640759,0.730972,0.635874,0.663705,0.615464,0.058072,0.652713,0.18156,0.595013,0.203315,0.532406,0.086079,0.544601,0.069572,0.594525,0.043937,0.361728,0.113404,0.408376,0.140266,0.402306,0.1591,0.45568,0.244374,0.51397,0.181876,0.559867,0.23097,0.843351,0.507407,0.901704,0.439627,0.95001,0.569897,0.836501,0.553868,0.919113,0.633779,0.90115,0.654064,0.858924,0.278823,0.854572,0.276353,0.895615,0.230555,0.402306,0.1591,0.432952,0.16697,0.436312,0.295772,0.878438,0.346704,0.905547,0.36054,0.901704,0.439627,0.476669,0.014262,0.508604,0.05854,0.408376,0.140266,0.408376,0.140266,0.508604,0.05854,0.51499,0.071022,0.594525,0.043937,0.615464,0.058072,0.559951,0.145409,0.547969,0.100163,0.559951,0.145409,0.51397,0.181876,0.559951,0.145409,0.595013,0.203315,0.559867,0.23097,0.74973,0.504223,0.756813,0.426782,0.901704,0.439627,0.853648,0.300718,0.848678,0.300524,0.854572,0.276353,0.436607,0.14482,0.432952,0.16697,0.402306,0.1591,0.534235,0.12281,0.465624,0.159751,0.518622,0.118778,0.432952,0.16697,0.436607,0.14482,0.518622,0.118778,0.531389,0.056333,0.544601,0.069572,0.532406,0.086079,0.436607,0.14482,0.51499,0.071022,0.532406,0.086079,0.532406,0.086079,0.547969,0.100163,0.534235,0.12281,0.51397,0.181876,0.45568,0.244374,0.465624,0.159751,0.45568,0.244374,0.436312,0.295772,0.436312,0.295772,0.45568,0.244374,0.518122,0.276744,0.750916,0.560168,0.74973,0.504223,0.843351,0.507407,0.843351,0.507407,0.95001,0.569897,0.919113,0.633779,0.750916,0.560168,0.836501,0.553868,0.844657,0.608946,0.765758,0.630861,0.844657,0.608946,0.865739,0.651489,0.844657,0.608946,0.90115,0.654064,0.897598,0.659664,0.348661,0.142,0.402306,0.1591,0.413593,0.292396,0.383885,0.310049,0.385287,0.292637,0.413593,0.292396,0.413593,0.292396,0.436312,0.295772,0.499817,0.317144,0.905547,0.36054,0.904483,0.316762,0.919231,0.299004,0.756813,0.426782,0.95064,0.651591,0.933427,0.676778,0.90115,0.654064,0.980143,0.570363,0.95064,0.651591,0.919113,0.633779,0.905547,0.36054,0.878438,0.346704,0.904483,0.316762,0.348661,0.308671,0.349396,0.291267,0.385287,0.292637,0.966805,0.308617,0.945716,0.369286,0.905547,0.36054,0.933427,0.676778,0.929801,0.681911,0.897598,0.659664,0.939738,0.436463,0.980143,0.570363,0.95001,0.569897,0.385287,0.292637,0.349396,0.291267,0.348661,0.142,0.904074,0.213427,0.907606,0.239108,0.895615,0.230555,0.966805,0.308617,0.919231,0.299004,0.907606,0.239108,0.476669,0.014262,0.493795,0.002011,0.531389,0.056333,0.508604,0.05854,0.531389,0.056333,0.51499,0.071022,0.945716,0.369286,0.939738,0.436463,0.901704,0.439627,0.663498,0.593864,0.676096,0.534164,0.724126,0.574665,0.724126,0.574665,0.729045,0.596644,0.70351,0.642221,0.858924,0.278823,0.907606,0.239108,0.919231,0.299004,0.878438,0.346704,0.853648,0.300718,0.858924,0.278823,0.227178,0.52855,0.293927,0.517279,0.197301,0.627629,0.159726,0.566458,0.16426,0.546442,0.172921,0.621006,0.124283,0.417131,0.073474,0.399352,0.13458,0.400233,0.224759,0.469913,0.234013,0.384953,0.291913,0.472602,0.733022,0.904977,0.675803,0.94917,0.742073,0.850039,0.676096,0.534164,0.688224,0.525808,0.724126,0.574665,0.242888,0.321718,0.260283,0.336716,0.13458,0.400233,0.073474,0.399352,0.127861,0.546406,0.124283,0.417131,0.141484,0.543088,0.18509,0.549028,0.227178,0.52855,0.172921,0.621006,0.193269,0.523836,0.224759,0.469913,0.18509,0.549028,0.224759,0.469913,0.291913,0.472602,0.227178,0.52855,0.823817,0.724266,0.729045,0.596644,0.160555,0.418298,0.14617,0.435533,0.160555,0.418298,0.180018,0.514648,0.141484,0.543088,0.16426,0.546442,0.141071,0.565101,0.141484,0.543088,0.14617,0.435533,0.16426,0.546442,0.180018,0.514648,0.176429,0.447754,0.234013,0.384953,0.193269,0.523836,0.160555,0.418298,0.260283,0.336716,0.176429,0.447754,0.234013,0.384953,0.260283,0.336716,0.299308,0.411094,0.827544,0.857731,0.742073,0.850039,0.658172,0.928595,0.735979,0.803473,0.827544,0.857731,0.811554,0.928173,0.711251,0.947172,0.679263,0.954827,0.733022,0.904977,0.224582,0.300126,0.242888,0.321718,0.086593,0.370781,0.224582,0.300126,0.236851,0.287693,0.242888,0.321718,0.249032,0.31557,0.317944,0.370846,0.242888,0.321718,0.677956,0.611859,0.67618,0.655614,0.663498,0.593864,0.823817,0.724266,0.658172,0.928595,0.675803,0.94917,0.62636,0.945892,0.628318,0.86422,0.658172,0.928595,0.598182,0.864196,0.236851,0.287693,0.224582,0.300126,0.212802,0.26192,0.675803,0.94917,0.679263,0.954827,0.643161,0.971357,0.678736,0.734753,0.680045,0.508544,0.676096,0.534164,0.60357,0.532871,0.075383,0.572113,0.073474,0.551144,0.141071,0.565101,0.67618,0.655614,0.678736,0.734753,0.635874,0.663705,0.676096,0.534164,0.615774,0.602702,0.60357,0.532871,0.559951,0.145409,0.615464,0.058072,0.595013,0.203315,0.547969,0.100163,0.532406,0.086079,0.594525,0.043937,0.348661,0.142,0.361728,0.113404,0.402306,0.1591,0.518122,0.276744,0.45568,0.244374,0.559867,0.23097,0.844657,0.608946,0.836501,0.553868,0.90115,0.654064,0.907606,0.239108,0.858924,0.278823,0.895615,0.230555,0.413593,0.292396,0.402306,0.1591,0.436312,0.295772,0.361728,0.113404,0.436607,0.14482,0.408376,0.140266,0.51499,0.071022,0.547969,0.100163,0.594525,0.043937,0.559951,0.145409,0.534235,0.12281,0.547969,0.100163,0.51397,0.181876,0.51397,0.181876,0.559951,0.145409,0.559867,0.23097,0.843351,0.507407,0.858924,0.278823,0.853648,0.300718,0.854572,0.276353,0.408376,0.140266,0.465624,0.159751,0.432952,0.16697,0.518622,0.118778,0.51499,0.071022,0.531389,0.056333,0.532406,0.086079,0.518622,0.118778,0.436607,0.14482,0.532406,0.086079,0.465624,0.159751,0.534235,0.12281,0.45568,0.244374,0.432952,0.16697,0.465624,0.159751,0.436312,0.295772,0.499817,0.317144,0.436312,0.295772,0.518122,0.276744,0.836501,0.553868,0.836501,0.553868,0.843351,0.507407,0.919113,0.633779,0.765758,0.630861,0.782044,0.679508,0.865739,0.651489,0.844657,0.608946,0.897598,0.659664,0.385287,0.292637,0.348661,0.142,0.413593,0.292396,0.412951,0.301065,0.383885,0.310049,0.413593,0.292396,0.412951,0.301065,0.413593,0.292396,0.499817,0.317144,0.966805,0.308617,0.905547,0.36054,0.919231,0.299004,0.853648,0.300718,0.848678,0.300524,0.919113,0.633779,0.95064,0.651591,0.90115,0.654064,0.95001,0.569897,0.980143,0.570363,0.919113,0.633779,0.383885,0.310049,0.348661,0.308671,0.385287,0.292637,0.90115,0.654064,0.933427,0.676778,0.897598,0.659664,0.901704,0.439627,0.966805,0.308617,0.907606,0.239108,0.980143,0.238994,0.508604,0.05854,0.476669,0.014262,0.531389,0.056333,0.905547,0.36054,0.945716,0.369286,0.901704,0.439627,0.907606,0.239108,0.904074,0.213427,0.980143,0.238994,0.677956,0.611859,0.663498,0.593864,0.724126,0.574665,0.677956,0.611859,0.724126,0.574665,0.70351,0.642221,0.904483,0.316762,0.858924,0.278823,0.919231,0.299004,0.904483,0.316762,0.878438,0.346704,0.858924,0.278823,0.146507,0.243549,0.140949,0.260688,0.112016,0.24355,0.457255,0.422956,0.446555,0.436195,0.419279,0.42788,0.460069,0.457029,0.50665,0.589949,0.476428,0.600546,0.50665,0.589949,0.512759,0.607374,0.482538,0.61797,0.460069,0.457029,0.446555,0.436195,0.457255,0.422956,0.100902,0.44082,0.1009,0.277827,0.135392,0.277827,0.419279,0.42788,0.446555,0.436195,0.50665,0.589949,0.460069,0.457029,0.475017,0.449366,0.459588,0.606257,0.412781,0.468228,0.429622,0.462517,0.20241,0.260688,0.195644,0.243549,0.230136,0.243549,0.363604,0.404042,0.370643,0.424872,0.34101,0.430315,0.356524,0.460235,0.298066,0.607171,0.266972,0.5948,0.298066,0.607171,0.290934,0.625098,0.25984,0.612727,0.308723,0.442223,0.331821,0.416596,0.34101,0.430315,0.209176,0.440821,0.209177,0.277826,0.243669,0.277826,0.370643,0.424872,0.32496,0.452701,0.298066,0.607171,0.356524,0.460235,0.374451,0.467368,0.248306,0.587149,0.308723,0.442223,0.32496,0.452701,0.429007,0.482219,0.355909,0.479936,0.356524,0.460235,0.185439,0.365614,0.182512,0.377068,0.16462,0.372665,0.429622,0.462517,0.385328,0.410129,0.404966,0.412764,0.419279,0.42788,0.414219,0.402012,0.404966,0.412764,0.385328,0.410129,0.372268,0.027103,0.380815,0.043187,0.355282,0.086767,0.379473,0.398285,0.385328,0.410129,0.370643,0.424872,0.419279,0.42788,0.404966,0.412764,0.414219,0.402012,0.406991,0.042299,0.380815,0.043187,0.372268,0.027103,0.406991,0.042299,0.413218,0.029413,0.439371,0.05948,0.380815,0.043187,0.406991,0.042299,0.424196,0.065914,0.439371,0.05948,0.462856,0.031324,0.499853,0.030567,0.360579,0.391339,0.378815,0.38808,0.379473,0.398285,0.417152,0.393737,0.432701,0.398503,0.428197,0.409863,0.379473,0.398285,0.378815,0.38808,0.417152,0.393737,0.181566,0.305081,0.185591,0.316478,0.16462,0.311204,0.355238,0.232306,0.371684,0.231142,0.378815,0.38808,0.421457,0.224485,0.439847,0.225078,0.432701,0.398503,0.371684,0.231142,0.421457,0.224485,0.417152,0.393737,0.432701,0.398503,0.439847,0.225078,0.48587,0.235174,0.339864,0.083854,0.355282,0.086767,0.371684,0.231142,0.421457,0.224485,0.424196,0.065914,0.439371,0.05948,0.355282,0.086767,0.439371,0.05948,0.521645,0.089492,0.185591,0.316478,0.185439,0.365614,0.16462,0.372665,0.428197,0.409863,0.476428,0.600546,0.475017,0.449366,0.135393,0.440819,0.523086,0.584085,0.476428,0.600546,0.331821,0.416596,0.266972,0.5948,0.32496,0.452701,0.243668,0.440822,0.34101,0.430315,0.315993,0.614303,0.266972,0.5948,0.429622,0.462517,0.370643,0.424872,0.385328,0.410129,0.419279,0.42788,0.379473,0.398285,0.414219,0.402012,0.385328,0.410129,0.339864,0.083854,0.372268,0.027103,0.355282,0.086767,0.363604,0.404042,0.379473,0.398285,0.370643,0.424872,0.428197,0.409863,0.419279,0.42788,0.414219,0.402012,0.413218,0.029413,0.424196,0.065914,0.406991,0.042299,0.439371,0.05948,0.499853,0.030567,0.363604,0.404042,0.414219,0.402012,0.360579,0.391339,0.355238,0.232306,0.378815,0.38808,0.417152,0.393737,0.421457,0.224485,0.432701,0.398503,0.378815,0.38808,0.474836,0.387992,0.355238,0.232306,0.439847,0.225078,0.16462,0.311204,0.185591,0.316478,0.16462,0.372665,0.232645,0.132761,0.222481,0.136971,0.179737,0.033778,0.854302,0.281336,0.858022,0.272354,0.933222,0.257395,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.211691,0.139117,0.200691,0.139117,0.222481,0.136971,0.150343,0.077769,0.15249,0.066979,0.189901,0.136971,0.179737,0.132761,0.17059,0.126649,0.17059,0.126649,0.162811,0.11887,0.1567,0.109723,0.1567,0.109723,0.15249,0.099559,0.150343,0.08877,0.255682,0.056816,0.262038,0.077769,0.262038,0.08877,0.15249,0.066979,0.1567,0.056816,0.162811,0.047669,0.162811,0.047669,0.17059,0.03989,0.179737,0.033778,0.179737,0.033778,0.189901,0.029568,0.200691,0.027422,0.222481,0.029568,0.232645,0.033778,0.211692,0.027422,0.249571,0.047669,0.255682,0.056816,0.211692,0.027422,0.255682,0.056816,0.259892,0.066979,0.262038,0.077769,0.259892,0.099559,0.259892,0.099559,0.255682,0.109723,0.249571,0.11887,0.249571,0.11887,0.241792,0.126649,0.1567,0.109723,0.222481,0.136971,0.189901,0.136971,0.189901,0.136971,0.17059,0.126649,0.1567,0.109723,0.255682,0.056816,0.200691,0.027422,0.211692,0.027422,0.15249,0.066979,0.162811,0.047669,0.179737,0.033778,0.232645,0.033778,0.241792,0.03989,0.249571,0.047669,0.232645,0.033778,0.249571,0.047669,0.211692,0.027422,0.1567,0.109723,0.259892,0.099559,0.249571,0.11887,0.232645,0.132761,0.200691,0.139117,0.150343,0.077769,0.200691,0.027422,0.232645,0.132761,0.255682,0.056816,0.259892,0.099559,0.1567,0.109723,0.150343,0.08877,0.150343,0.077769,0.933222,0.257395,0.878382,0.251994,0.925138,0.251994,0.933222,0.257395,0.940096,0.26427,0.945498,0.272354,0.896899,0.345087,0.887364,0.34319,0.878382,0.33947,0.949218,0.310128,0.949218,0.281336,0.951115,0.300593,0.940097,0.327194,0.933222,0.334068,0.945498,0.31911,0.854302,0.310128,0.852405,0.300593,0.852405,0.290871,0.906621,0.345087,0.896899,0.345087,0.916156,0.34319,0.858022,0.272354,0.863423,0.26427,0.870298,0.257396,0.870298,0.334068,0.896899,0.345087,0.878382,0.33947,0.870298,0.334068,0.863424,0.327194,0.858022,0.31911,0.949218,0.281336,0.951115,0.290871,0.951115,0.300593,0.854302,0.281336,0.854302,0.310128,0.852405,0.290871,0.933222,0.334068,0.945498,0.31911,0.878382,0.251994,0.858022,0.272354,0.870298,0.257396,0.878382,0.251994,0.887364,0.248274,0.896899,0.246377,0.916156,0.248274,0.925138,0.251994,0.906621,0.246377,0.945498,0.272354,0.949218,0.281336,0.933222,0.257395,0.949218,0.281336,0.949218,0.310128,0.933222,0.257395,0.933222,0.334068,0.925138,0.33947,0.854302,0.281336,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.858022,0.31911,0.854302,0.310128,0.870298,0.334068,0.854302,0.310128,0.870298,0.334068,0.858022,0.272354,0.878382,0.251994,0.933222,0.257395,0.906621,0.246377,0.925138,0.251994,0.896899,0.345087,0.925138,0.33947,0.916156,0.34319,0.870298,0.334068,0.854302,0.281336,0.896899,0.345087,0.896899,0.246377,0.906621,0.246377,0.878382,0.251994,0.854302,0.281336,0.925138,0.33947,0.896899,0.345087,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.949218,0.310128,0.933222,0.334068,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.989554,0.052633,0.989554,0.217024,0.825163,0.217024,0.825163,0.052633,0.989554,0.052633,0.989554,0.217024,0.825163,0.052633,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.052633,0.825163,0.217024,0.825163,0.217024,0.825163,0.052633,0.476865,0.243236,0.472233,0.259129,0.446028,0.241309,0.463177,0.27923,0.438714,0.25678,0.446028,0.241309,0.24234,0.249821,0.250973,0.214309,0.411131,0.25129,0.565704,0.103501,0.539498,0.085682,0.549771,0.070572,0.446028,0.241309,0.438714,0.25678,0.411131,0.25129,0.481497,0.227342,0.455291,0.209523,0.539498,0.085682,0.463177,0.27923,0.41536,0.292381,0.255664,0.194846,0.415184,0.2333,0.411131,0.25129,0.24234,0.249821,0.41536,0.292381,0.402631,0.311341,0.535776,0.302337,0.509568,0.284517,0.523564,0.27499,0.532957,0.355551,0.50542,0.323815,0.52811,0.31277,0.504662,0.57818,0.472273,0.575659,0.484568,0.37328,0.647975,0.159433,0.621767,0.141614,0.632041,0.126503,0.532957,0.355551,0.553235,0.358602,0.547581,0.396179,0.563768,0.283283,0.53756,0.265463,0.621767,0.141614,0.526212,0.393014,0.50542,0.323815,0.448827,0.574473,0.458551,0.382301,0.484568,0.37328,0.504662,0.57818,0.526212,0.393014,0.547581,0.396179,0.41536,0.292381,0.484568,0.37328,0.458551,0.382301,0.32378,0.42584,0.349367,0.424847,0.338104,0.440823,0.463177,0.27923,0.48917,0.279259,0.50785,0.296601,0.490195,0.260098,0.525592,0.293425,0.50785,0.296601,0.218759,0.284915,0.200986,0.225106,0.216341,0.20975,0.50542,0.323815,0.50785,0.296601,0.525592,0.293425,0.463177,0.27923,0.472233,0.259129,0.490195,0.260098,0.216341,0.20975,0.200986,0.225106,0.168716,0.211491,0.117449,0.211716,0.168197,0.192741,0.168716,0.211491,0.127051,0.233672,0.168716,0.211491,0.200986,0.225106,0.107583,0.234114,0.006473,0.275229,0.030939,0.200849,0.179897,0.649735,0.181607,0.62953,0.200879,0.630881,0.114737,0.672094,0.114259,0.64469,0.133322,0.64442,0.133866,0.671739,0.133322,0.64442,0.181607,0.62953,0.34007,0.351001,0.356886,0.360085,0.32378,0.373717,0.200879,0.630881,0.181607,0.62953,0.190468,0.453094,0.133322,0.64442,0.114259,0.64469,0.111421,0.443159,0.133322,0.64442,0.132571,0.442701,0.190468,0.453094,0.114259,0.64469,0.065883,0.63179,0.055627,0.455566,0.209722,0.455137,0.190468,0.453094,0.218759,0.284915,0.111421,0.443159,0.107583,0.234114,0.127051,0.233672,0.127051,0.233672,0.356886,0.360085,0.349367,0.424847,0.32378,0.42584,0.472233,0.259129,0.575978,0.088392,0.415184,0.2333,0.565704,0.103501,0.438714,0.25678,0.250973,0.214309,0.238079,0.266266,0.55026,0.34278,0.658249,0.144323,0.526212,0.393014,0.647975,0.159433,0.532957,0.355551,0.472273,0.575659,0.528465,0.580686,0.402631,0.311341,0.50542,0.323815,0.463177,0.27923,0.50785,0.296601,0.48917,0.279259,0.237027,0.284101,0.52811,0.31277,0.50542,0.323815,0.525592,0.293425,0.48917,0.279259,0.463177,0.27923,0.490195,0.260098,0.168197,0.192741,0.127051,0.233672,0.117449,0.211716,0.168716,0.211491,0.218759,0.284915,0.200986,0.225106,0.077054,0.200111,0.199156,0.651355,0.179897,0.649735,0.200879,0.630881,0.133866,0.671739,0.114737,0.672094,0.133322,0.64442,0.179897,0.649735,0.133866,0.671739,0.181607,0.62953,0.209722,0.455137,0.200879,0.630881,0.190468,0.453094,0.132571,0.442701,0.111421,0.443159,0.237027,0.284101,0.209722,0.455137,0.218759,0.284915,0.132571,0.442701,0.111421,0.443159,0.127051,0.233672,0.32378,0.373717,0.356886,0.360085,0.32378,0.42584,0.267382,0.524289,0.293915,0.546474,0.293888,0.560804,0.344164,0.524243,0.311693,0.546462,0.293915,0.546474,0.344164,0.524243,0.344059,0.582827,0.311635,0.560699,0.344059,0.582827,0.26727,0.582827,0.293888,0.560804,0.293915,0.546474,0.311693,0.546462,0.311635,0.560699,0.497432,0.203739,0.633195,0.170863,0.60695,0.199317,0.432511,0.783928,0.435012,0.845863,0.413621,0.90404,0.29367,0.621901,0.293598,0.620526,0.358186,0.593164,0.224731,0.598375,0.2264,0.597514,0.26727,0.582827,0.267382,0.524289,0.293888,0.560804,0.267382,0.524289,0.311693,0.546462,0.311635,0.560699,0.344059,0.582827,0.293888,0.560804,0.293888,0.560804,0.571814,0.215561,0.533764,0.217098,0.497432,0.203739,0.452734,0.142358,0.633195,0.170863,0.468979,0.177495,0.464531,0.067349,0.644992,0.095854,0.451172,0.10368,0.525911,0.022651,0.600293,0.034472,0.490776,0.038895,0.525911,0.022651,0.563962,0.021114,0.600293,0.034472,0.644992,0.095854,0.464531,0.067349,0.628747,0.060717,0.633195,0.170863,0.452734,0.142358,0.646553,0.134532,0.571814,0.215561,0.497432,0.203739,0.60695,0.199317,0.464531,0.067349,0.600293,0.034472,0.628747,0.060717,0.633195,0.170863,0.497432,0.203739,0.468979,0.177495,0.644992,0.095854,0.452734,0.142358,0.451172,0.10368,0.600293,0.034472,0.464531,0.067349,0.490776,0.038895,0.253397,0.978117,0.192349,0.958176,0.146932,0.915992,0.646553,0.134532,0.413621,0.90404,0.371595,0.949604,0.315332,0.975616,0.142535,0.738324,0.406499,0.727665,0.432511,0.783928,0.120896,0.85974,0.11832,0.797807,0.142535,0.738324,0.240824,0.66675,0.302759,0.664249,0.184561,0.692761,0.360936,0.685639,0.406499,0.727665,0.302759,0.664249,0.413621,0.90404,0.146932,0.915992,0.120896,0.85974,0.142535,0.738324,0.253397,0.978117,0.146932,0.915992,0.142535,0.738324,0.302759,0.664249,0.406499,0.727665,0.142535,0.738324,0.142535,0.738324,0.315332,0.975616,0.253397,0.978117,0.302759,0.664249,0.142535,0.738324,0.184561,0.692761,0.142535,0.738324,0.413621,0.90404,0.315332,0.975616,0.359147,0.594103,0.859204,0.473719,0.825108,0.444197,0.844715,0.42579,0.877627,0.424833,0.902844,0.449929,0.815849,0.421395,0.815473,0.401629,0.833724,0.402331,0.822042,0.38207,0.836855,0.389239,0.740427,0.41033,0.764852,0.381486,0.792404,0.396478,0.78103,0.357947,0.803723,0.371863,0.890399,0.361614,0.914171,0.385895,0.885678,0.396047,0.885104,0.411492,0.852505,0.375857,0.84657,0.357636,0.867384,0.354362,0.831655,0.368408,0.832968,0.335959,0.805859,0.315597,0.81751,0.279952,0.816036,0.354343,0.793375,0.338021,0.917063,0.418097,0.843407,0.381031,0.732373,0.347284,0.864048,0.376281,0.732373,0.454457,0.786778,0.422814,0.820067,0.506781,0.787876,0.461423,0.907204,0.327461,0.940093,0.355632,0.865709,0.311831,0.906154,0.591543,0.885136,0.595595,0.87159,0.571237,0.908699,0.556443,0.952084,0.574521,0.925153,0.602973,0.815267,0.573477,0.817336,0.613376,0.782595,0.626704,0.825613,0.645612,0.795946,0.657247,0.758589,0.591244,0.873811,0.60534,0.867801,0.6175,0.84605,0.613512,0.869869,0.63319,0.849593,0.638558,0.916349,0.656188,0.930207,0.639277,0.974645,0.658185,0.932741,0.620398,0.812627,0.708102,0.848124,0.694754,0.870645,0.724982,0.834509,0.669587,0.805029,0.681726,0.817906,0.749774,0.870819,0.674664,0.885297,0.656546,0.90009,0.659786,0.857589,0.657148,0.974645,0.610911,0.740736,0.658976,0.875532,0.646352,0.853514,0.591235,0.893786,0.690063,0.887748,0.517899,0.931967,0.696848,0.912874,0.745613,0.982464,0.913625,0.959367,0.917027,0.941124,0.889743,0.870419,0.94737,0.855023,0.925273,0.873942,0.916698,0.901381,0.981668,0.907421,0.928052,0.920049,0.965986,0.953691,0.953569,0.93302,0.945662,0.959505,0.934725,0.906282,0.90073,0.876878,0.896863,0.990263,0.859172,0.971181,0.872301,0.945746,0.854086,0.894912,0.881121,0.917464,0.855596,0.8736,0.857036,0.943969,0.808513,0.96971,0.831625,0.895611,0.840925,0.773138,0.790587,0.803775,0.776498,0.82351,0.801406,0.917915,0.774185,0.89306,0.800938,0.863574,0.818327,0.861611,0.876563,0.885148,0.768141,0.839613,0.766814,0.851744,0.899124,0.836208,0.838351,0.841339,0.875818,0.756101,0.87527,0.794499,0.843096,0.81915,0.860442,0.823856,0.898546,0.757207,0.83444,0.785351,0.89099,0.768767,0.92125,0.745128,0.918127,0.776942,0.959603,0.771231,0.940695,0.802369,0.922965,0.833965,0.940872,0.808872,0.964326,0.799211,0.951334,0.820843,0.975197,0.851267,0.989396,0.863491,0.744909,0.868168,0.989396,0.978338,0.892454,0.952062,0.786093,0.78313,0.811636,0.736621,0.861536,0.749019,0.896444,0.6761,0.733486,0.671202,0.733104,0.671231,0.597368,0.663292,0.73296,0.655171,0.733109,0.651339,0.589026,0.649715,0.733493,0.648733,0.733975,0.64991,0.591979,0.652399,0.73439,0.659389,0.734607,0.667431,0.734559,0.668064,0.589545,0.673965,0.734262,0.67683,0.733806,0.767884,0.493431,0.782844,0.511406,0.772916,0.502749,0.791099,0.516965,0.787907,0.512686,0.755884,0.48587,0.754079,0.482872,0.779108,0.503756,0.758453,0.485581,0.762932,0.493291,0.789614,0.51653,0.292133,0.463692,0.271033,0.48433,0.293465,0.19226,0.246968,0.52327,0.264203,0.192554,0.224731,0.598375,0.233209,0.192707,0.193158,0.5977,0.201821,0.192315,0.594595,0.318194,0.382965,0.608434,0.359147,0.594103,0.345483,0.443522,0.345424,0.443701,0.335312,0.442064,0.551163,0.28367,0.384709,0.533706,0.385578,0.500175,0.530083,0.267062,0.379021,0.481205,0.509531,0.251762,0.371099,0.466445,0.42072,0.20638,0.345541,0.443349,0.33528,0.441671,0.376098,0.510296,0.351058,0.513956,0.364141,0.500629,0.309933,0.452582,0.320837,0.192358,0.32734,0.49575,0.319289,0.482768,0.332372,0.469441,0.354685,0.448395,0.363145,0.455985,0.443991,0.214928,0.323935,0.444907,0.371928,0.195713,0.488413,0.237678,0.346649,0.193333,0.57271,0.300999,0.322486,0.457665,0.337929,0.506146,0.342962,0.479837,0.370878,0.466589,0.362829,0.456279,0.444152,0.214525,0.466774,0.224822,0.247871,0.523621,0.383988,0.533517,0.310101,0.452857,0.292411,0.46402,0.264194,0.192031,0.293459,0.191768,0.551455,0.283296,0.573007,0.300619,0.378723,0.481337,0.385146,0.500227,0.346674,0.192888,0.371981,0.195275,0.324032,0.445125,0.271532,0.484695,0.594889,0.317812,0.396809,0.199459,0.201823,0.191767,0.233206,0.192163,0.466578,0.225213,0.488642,0.2373,0.362989,0.456129,0.354462,0.448711,0.396719,0.199887,0.420848,0.205965,0.530358,0.266697,0.335295,0.441866,0.320842,0.191896,0.509784,0.251396,0.354574,0.448551,0.574914,0.365231,0.57857,0.367824,0.429985,0.577352,0.860966,0.430815,0.83622,0.415014,0.875855,0.38223,0.757376,0.303782,0.758659,0.710488,0.845859,0.540668,0.835199,0.98333,0.884937,0.986829,0.353552,0.490233,0.426328,0.574759,0.940548,0.712354,0.940548,0.695591,0.870992,0.695591,0.871113,0.738336,0.871113,0.721572,0.94067,0.721572,0.952951,0.859438,0.970803,0.859438,0.970803,0.789882,0.971984,0.782675,0.954132,0.782675,0.954132,0.713119,0.940583,0.762638,0.940583,0.745874,0.871557,0.745874,0.871113,0.785077,0.871113,0.768313,0.94067,0.768313,0.87286,0.807515,0.87286,0.790752,0.941886,0.790752,0.870376,0.689377,0.939402,0.689377,0.939402,0.619821,0.939524,0.611432,0.870498,0.611432,0.870498,0.541876,0.861832,0.861444,0.861832,0.51519,0.843151,0.51519,0.804183,0.859968,0.804183,0.513714,0.774772,0.513714,0.630401,0.86292,0.630401,0.516666,0.649082,0.516666,0.73639,0.859968,0.73639,0.513714,0.765801,0.513714,0.909699,0.831504,0.93911,0.831504,0.93911,0.812824,0.90368,0.832685,0.874269,0.832685,0.874269,0.814005,0.831843,0.861444,0.831843,0.51519,0.813163,0.51519,0.727419,0.861444,0.727419,0.51519,0.698008,0.51519,0.603366,0.86292,0.603366,0.516666,0.622046,0.516666,0.659626,0.861444,0.659626,0.51519,0.689037,0.51519,0.909699,0.858203,0.93911,0.858203,0.93911,0.839523,0.90368,0.859384,0.874269,0.859384,0.874269,0.840704,0.870992,0.712354,0.94067,0.738336,0.952951,0.789882,0.971984,0.713119,0.871557,0.762638,0.94067,0.785077,0.941886,0.807515,0.870376,0.619821,0.939524,0.541876,0.843151,0.861444,0.774772,0.859968,0.649082,0.86292,0.765801,0.859968,0.909699,0.812824,0.90368,0.814005,0.813163,0.861444,0.698008,0.861444,0.622046,0.86292,0.689037,0.861444,0.909699,0.839523,0.90368,0.840704,0.635207,0.448559,0.760975,0.410408,0.670302,0.501082,0.873289,0.376706,0.900794,0.467379,0.810121,0.494885,0.708453,0.508671,0.695319,0.508671,0.721335,0.506108,0.682436,0.506108,0.670302,0.501082,0.695319,0.508671,0.659381,0.493785,0.642796,0.473576,0.670302,0.501082,0.659381,0.493785,0.650093,0.484497,0.642796,0.473576,0.63777,0.461441,0.695319,0.508671,0.73347,0.501082,0.721335,0.506108,0.63777,0.422543,0.642796,0.410408,0.650093,0.399487,0.670302,0.382903,0.635207,0.435425,0.659381,0.3902,0.695319,0.375314,0.708453,0.375314,0.682436,0.377876,0.708453,0.375314,0.73347,0.382903,0.744391,0.3902,0.753678,0.399487,0.760975,0.410408,0.766002,0.422543,0.768564,0.435425,0.768564,0.435425,0.768564,0.448559,0.766002,0.461441,0.753678,0.484497,0.73347,0.501082,0.760975,0.473576,0.753678,0.484497,0.744391,0.493785,0.73347,0.501082,0.721335,0.377876,0.760975,0.473576,0.682436,0.377876,0.873289,0.376706,0.884209,0.384003,0.893497,0.39329,0.873289,0.494885,0.861154,0.499911,0.848272,0.502473,0.908383,0.442362,0.873289,0.376706,0.908383,0.429228,0.908383,0.442362,0.90582,0.455244,0.88421,0.487588,0.893497,0.4783,0.893497,0.4783,0.873289,0.494885,0.835137,0.502473,0.835137,0.502473,0.873289,0.494885,0.848272,0.502473,0.835137,0.502473,0.822255,0.499911,0.810121,0.494885,0.789912,0.4783,0.777589,0.455244,0.7992,0.487587,0.789912,0.4783,0.782615,0.467379,0.777589,0.455244,0.775026,0.429227,0.777589,0.416345,0.775026,0.442362,0.782615,0.404211,0.777589,0.455244,0.777589,0.416345,0.822255,0.371679,0.789913,0.39329,0.810121,0.376705,0.822255,0.371679,0.835137,0.369117,0.848272,0.369117,0.848272,0.369117,0.861154,0.371679,0.873289,0.376706,0.900794,0.404211,0.90582,0.416346,0.908383,0.429228,0.789913,0.39329,0.822255,0.371679,0.848272,0.369117,0.835137,0.502473,0.789913,0.39329,0.7992,0.384002,0.810121,0.376705,0.777589,0.416345,0.777589,0.455244,0.775026,0.442362,0.900794,0.404211,0.908383,0.429228,0.7992,0.487587,0.777589,0.455244,0.782615,0.404211,0.900794,0.404211,0.848272,0.369117,0.873289,0.376706,0.810121,0.494885,0.848272,0.369117,0.789913,0.39329,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.670302,0.382903,0.753678,0.484497,0.682436,0.506108,0.810121,0.494885,0.782615,0.404211,0.900794,0.467379,0.708453,0.375314,0.73347,0.382903,0.721335,0.506108,0.695319,0.508671,0.682436,0.506108,0.670302,0.501082,0.659381,0.493785,0.642796,0.473576,0.635207,0.448559,0.650093,0.484497,0.642796,0.473576,0.63777,0.461441,0.635207,0.448559,0.635207,0.448559,0.635207,0.435425,0.63777,0.422543,0.642796,0.410408,0.650093,0.399487,0.659381,0.3902,0.670302,0.382903,0.670302,0.382903,0.682436,0.377876,0.695319,0.375314,0.721335,0.377876,0.73347,0.382903,0.708453,0.375314,0.753678,0.399487,0.760975,0.410408,0.768564,0.435425,0.659381,0.493785,0.760975,0.410408,0.766002,0.422543,0.768564,0.435425,0.753678,0.484497,0.768564,0.448559,0.760975,0.473576,0.73347,0.501082,0.721335,0.506108,0.744391,0.493785,0.744391,0.493785,0.63777,0.422543,0.650093,0.399487,0.695319,0.375314,0.73347,0.382903,0.744391,0.3902,0.753678,0.399487,0.768564,0.448559,0.766002,0.461441,0.760975,0.473576,0.721335,0.506108,0.708453,0.508671,0.695319,0.508671,0.893497,0.39329,0.884209,0.384003,0.893497,0.39329,0.900794,0.404211,0.90582,0.416346,0.908383,0.442362,0.900794,0.467379,0.908383,0.429228,0.908383,0.442362,0.90582,0.455244,0.900794,0.467379,0.835137,0.369117,0.848272,0.369117,0.861154,0.371679,0.861154,0.499911,0.893497,0.4783,0.873289,0.494885,0.861154,0.499911,0.848272,0.502473,0.835137,0.502473,0.835137,0.502473,0.822255,0.499911,0.810121,0.494885,0.789912,0.4783,0.782615,0.467379,0.7992,0.487587,0.775026,0.442362,0.775026,0.429227,0.777589,0.416345,0.789913,0.39329,0.7992,0.384002,0.810121,0.376705,0.861154,0.499911,0.900794,0.467379,0.893497,0.4783,0.822255,0.371679,0.777589,0.416345,0.782615,0.404211,0.782615,0.467379,0.873289,0.376706,0.835137,0.369117,0.861154,0.371679,0.90582,0.416346,0.908383,0.429228,0.893497,0.39329,0.908383,0.429228,0.893497,0.39329,0.810121,0.494885,0.900794,0.467379,0.835137,0.502473,0.777589,0.455244,0.775026,0.442362,0.782615,0.467379,0.775026,0.442362,0.777589,0.416345,0.782615,0.467379,0.782615,0.404211,0.789913,0.39329,0.873289,0.376706,0.861154,0.499911,0.835137,0.502473,0.893497,0.4783,0.88421,0.487588,0.873289,0.494885,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.944188,0.098156,0.944188,0.212158,0.944188,0.098156,0.944188,0.212158,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.830186,0.212158,0.830186,0.098156,0.830186,0.098156,0.830186,0.212158,0.25339,0.056793,0.230423,0.132505,0.154712,0.109538,0.833521,0.356263,0.863829,0.319332,0.952986,0.392502,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.209535,0.138841,0.198567,0.138841,0.220291,0.136702,0.198567,0.138841,0.187811,0.136702,0.16856,0.126412,0.187811,0.136702,0.177679,0.132505,0.16856,0.126412,0.160805,0.118657,0.148375,0.088649,0.148375,0.077682,0.150515,0.099405,0.154712,0.056793,0.177679,0.033826,0.198568,0.027489,0.230423,0.132505,0.177679,0.033826,0.154712,0.056793,0.16856,0.039919,0.177679,0.033826,0.187811,0.029629,0.198568,0.027489,0.209535,0.027489,0.220291,0.029629,0.230423,0.033826,0.239542,0.039919,0.209535,0.027489,0.230423,0.033826,0.239542,0.039919,0.247297,0.047674,0.25339,0.056793,0.25339,0.056793,0.257587,0.066925,0.259727,0.077682,0.257587,0.099405,0.25339,0.056793,0.259727,0.088649,0.257587,0.099405,0.25339,0.109538,0.247297,0.118657,0.247297,0.118657,0.239542,0.126412,0.230423,0.132505,0.154712,0.056793,0.198568,0.027489,0.209535,0.027489,0.148375,0.077682,0.150515,0.066925,0.154712,0.056793,0.148375,0.077682,0.154712,0.056793,0.154712,0.109538,0.25339,0.056793,0.259727,0.077682,0.259727,0.088649,0.209535,0.027489,0.239542,0.039919,0.154712,0.056793,0.160805,0.047674,0.16856,0.039919,0.257587,0.099405,0.247297,0.118657,0.230423,0.132505,0.16856,0.126412,0.154712,0.056793,0.257587,0.099405,0.148375,0.077682,0.154712,0.109538,0.150515,0.099405,0.932853,0.326131,0.932853,0.326131,0.941505,0.334783,0.948304,0.344957,0.955374,0.368264,0.955374,0.3805,0.952986,0.356263,0.948304,0.344957,0.955374,0.3805,0.941506,0.413981,0.932853,0.422634,0.948304,0.403807,0.922679,0.429432,0.899372,0.436502,0.887136,0.436502,0.911374,0.434115,0.922679,0.319332,0.887136,0.312262,0.899372,0.312262,0.853655,0.422634,0.863829,0.429432,0.853655,0.422634,0.845002,0.413981,0.838204,0.403807,0.831134,0.3805,0.853655,0.422634,0.833521,0.392502,0.831134,0.3805,0.831134,0.368264,0.833521,0.356263,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.863829,0.319332,0.838204,0.344958,0.853655,0.326131,0.863829,0.319332,0.875134,0.31465,0.887136,0.312262,0.911374,0.31465,0.922679,0.319332,0.899372,0.312262,0.948304,0.344957,0.952986,0.392502,0.932853,0.326131,0.955374,0.3805,0.948304,0.344957,0.952986,0.356263,0.833521,0.356263,0.948304,0.403807,0.863829,0.319332,0.922679,0.319332,0.932853,0.326131,0.853655,0.422634,0.831134,0.3805,0.887136,0.436502,0.922679,0.429432,0.911374,0.434115,0.838204,0.344958,0.845002,0.334783,0.853655,0.326131,0.887136,0.436502,0.875134,0.434115,0.863829,0.429432,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.863829,0.319332,0.833521,0.356263,0.838204,0.344958,0.887136,0.436502,0.853655,0.422634,0.838204,0.403807,0.833521,0.392502,0.922679,0.319332,0.863829,0.319332,0.887136,0.312262,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.822378,0.060672,0.978784,0.060672,0.978784,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.978784,0.060672,0.978784,0.217079,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.217079,0.822378,0.217079,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672,0.822378,0.060672],
"normals":[-0.583684,-0.109706,-0.804535,-0.583684,-0.109706,-0.804535,-0.583684,-0.109706,-0.804535,-0.129207,-0.172618,-0.976478,-0.129207,-0.172618,-0.976478,-0.129207,-0.172618,-0.976478,-0.015119,0.99988,0.003319,-0.015119,0.99988,0.003319,-0.015119,0.99988,0.003319,-0.630498,0.766819,-0.120249,-0.630498,0.766819,-0.120249,-0.630498,0.766819,-0.120249,0.110217,-0.350839,-0.929927,0.110217,-0.350839,-0.929927,0.110217,-0.350839,-0.929927,0.199485,0.055661,-0.978319,0.199485,0.055661,-0.978319,0.199485,0.055661,-0.978319,-0.950009,0.312223,0,-0.950009,0.312223,0,-0.950009,0.312223,0,0.145407,0.458409,-0.876766,0.145407,0.458409,-0.876766,0.145407,0.458409,-0.876766,-0,-1,0,-0,-1,0,-0,-1,0,-0.840185,0.542296,0.0018,-0.840185,0.542296,0.0018,-0.840185,0.542296,0.0018,-0.516943,0.396623,-0.758591,-0.516943,0.396623,-0.758591,-0.516943,0.396623,-0.758591,-0.113008,-0.109138,-0.987582,-0.113008,-0.109138,-0.987582,-0.113008,-0.109138,-0.987582,0.001561,0.012412,-0.999922,0.001561,0.012412,-0.999922,0.001561,0.012412,-0.999922,-0.870151,0.358783,-0.337806,-0.870151,0.358783,-0.337806,-0.870151,0.358783,-0.337806,0.982791,0.18472,0,0.982791,0.18472,0,0.982791,0.18472,0,-0.719317,-0.694682,0,-0.719317,-0.694682,0,-0.719317,-0.694682,0,-0.007006,0.463322,-0.886162,-0.007006,0.463322,-0.886162,-0.007006,0.463322,-0.886162,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,-0.233388,0.16669,-0.95799,-0.233388,0.16669,-0.95799,-0.233388,0.16669,-0.95799,-0.245,-0.471061,-0.847394,-0.245,-0.471061,-0.847394,-0.245,-0.471061,-0.847394,-0.024571,0.041856,-0.998821,-0.024571,0.041856,-0.998821,-0.024571,0.041856,-0.998821,0,0,-1,0,0,-1,0,0,-1,0.023028,-0.030713,-0.999263,0.023028,-0.030713,-0.999263,0.023028,-0.030713,-0.999263,0.002577,-0.050279,-0.998732,0.002577,-0.050279,-0.998732,0.002577,-0.050279,-0.998732,-0.093542,0.986766,-0.132447,-0.093542,0.986766,-0.132447,-0.093542,0.986766,-0.132447,0.924496,-0.381191,-0,0.924496,-0.381191,-0,0.924496,-0.381191,-0,0.180897,0.001229,-0.983501,0.180897,0.001229,-0.983501,0.180897,0.001229,-0.983501,0.635107,-0.772424,-0,0.635107,-0.772424,-0,0.635107,-0.772424,-0,0.094373,-0.995537,-0,0.094373,-0.995537,-0,0.094373,-0.995537,-0,0.3548,0.240549,-0.903467,0.3548,0.240549,-0.903467,0.3548,0.240549,-0.903467,0.553582,0.83279,0.002765,0.553582,0.83279,0.002765,0.553582,0.83279,0.002765,0.885191,0.033505,-0.46402,0.885191,0.033505,-0.46402,0.885191,0.033505,-0.46402,0.999284,0.037823,0,0.999284,0.037823,0,0.999284,0.037823,0,-0.99829,-0.051482,-0.027689,-0.99829,-0.051482,-0.027689,-0.99829,-0.051482,-0.027689,-0,-1,0,-0,-1,0,0.963207,0.268755,0.001591,0.963207,0.268755,0.001591,0.963207,0.268755,0.001591,0.999977,0.006795,0.00004,0.999977,0.006795,0.00004,0.999977,0.006795,0.00004,-0.990735,0.034595,0.131326,-0.990735,0.034595,0.131326,-0.990735,0.034595,0.131326,0.525119,0.851014,0.005038,0.525119,0.851014,0.005038,0.525119,0.851014,0.005038,-0.997733,-0.067299,-0.000398,-0.997733,-0.067299,-0.000398,-0.997733,-0.067299,-0.000398,0.827695,0.561169,0.003322,0.827695,0.561169,0.003322,0.827695,0.561169,0.003322,0.299706,-0.954015,-0.005656,0.299706,-0.954015,-0.005656,0.299706,-0.954015,-0.005656,0.553578,0.832783,0.004931,0.553578,0.832783,0.004931,0.553578,0.832783,0.004931,-0.461423,-0.88718,0,-0.461423,-0.88718,0,-0.461423,-0.88718,0,-0.38126,-0.92442,0.009439,-0.38126,-0.92442,0.009439,-0.38126,-0.92442,0.009439,-0.989852,0.142104,0.000472,-0.989852,0.142104,0.000472,-0.989852,0.142104,0.000472,-0.897307,0.285782,-0.336406,-0.897307,0.285782,-0.336406,-0.897307,0.285782,-0.336406,-0.000004,-0.999982,-0.005929,-0.000004,-0.999982,-0.005929,-0.000004,-0.999982,-0.005929,-0.583684,-0.109706,0.804536,-0.583684,-0.109706,0.804536,-0.583684,-0.109706,0.804536,-0.800185,0.213306,0.560539,-0.800185,0.213306,0.560539,-0.800185,0.213306,0.560539,-0.015119,0.99988,-0.00332,-0.015119,0.99988,-0.00332,-0.015119,0.99988,-0.00332,-0.591278,0.788623,0.168713,-0.591278,0.788623,0.168713,-0.591278,0.788623,0.168713,0.110217,-0.350839,0.929927,0.110217,-0.350839,0.929927,0.110217,-0.350839,0.929927,0.199485,0.055661,0.978319,0.199485,0.055661,0.978319,0.199485,0.055661,0.978319,-0.950009,0.312223,0,-0.950009,0.312223,0,-0.950009,0.312223,0,0.145407,0.458409,0.876766,0.145407,0.458409,0.876766,0.145407,0.458409,0.876766,-0,-1,0,-0,-1,0,-0,-1,0,-0.840185,0.542296,-0.0018,-0.840185,0.542296,-0.0018,-0.840185,0.542296,-0.0018,-0.801371,0.517244,0.300439,-0.801371,0.517244,0.300439,-0.801371,0.517244,0.300439,-0.113008,-0.109138,0.987582,-0.113008,-0.109138,0.987582,-0.113008,-0.109138,0.987582,0.00156,0.012412,0.999922,0.00156,0.012412,0.999922,0.00156,0.012412,0.999922,-0.870151,0.358783,0.337806,-0.870151,0.358783,0.337806,-0.870151,0.358783,0.337806,0.982791,0.18472,0,0.982791,0.18472,0,0.982791,0.18472,0,-0.719316,-0.694683,0,-0.719316,-0.694683,0,-0.719316,-0.694683,0,-0.007006,0.463322,0.886162,-0.007006,0.463322,0.886162,-0.007006,0.463322,0.886162,0,0,1,0,0,1,0,0,1,-0.00053,0.035016,0.999387,-0.00053,0.035016,0.999387,-0.00053,0.035016,0.999387,-0.244999,-0.471061,0.847394,-0.244999,-0.471061,0.847394,-0.244999,-0.471061,0.847394,-0.211273,0.139522,0.967418,-0.211273,0.139522,0.967418,-0.211273,0.139522,0.967418,0,0,1,0,0,1,0.023028,-0.030713,0.999263,0.023028,-0.030713,0.999263,0.023028,-0.030713,0.999263,0.002577,-0.050279,0.998732,0.002577,-0.050279,0.998732,0.002577,-0.050279,0.998732,-0.050486,0.985017,0.164904,-0.050486,0.985017,0.164904,-0.050486,0.985017,0.164904,0.924496,-0.381191,-0,0.924496,-0.381191,-0,0.924496,-0.381191,-0,0.180897,0.001229,0.983501,0.180897,0.001229,0.983501,0.180897,0.001229,0.983501,0.635107,-0.772424,-0,0.635107,-0.772424,-0,0.635107,-0.772424,-0,0.094373,-0.995537,-0,0.094373,-0.995537,-0,0.094373,-0.995537,-0,0.354801,0.240549,0.903467,0.354801,0.240549,0.903467,0.354801,0.240549,0.903467,0.553582,0.83279,-0.002765,0.553582,0.83279,-0.002765,0.553582,0.83279,-0.002765,0.525126,0.851024,0,0.525126,0.851024,0,0.525126,0.851024,0,0.999284,0.037826,-0,0.999284,0.037826,-0,0.999284,0.037826,-0,-0.99813,-0.017505,-0.058574,-0.99813,-0.017505,-0.058574,-0.99813,-0.017505,-0.058574,-0,-1,0,0.963207,0.268755,-0.001591,0.963207,0.268755,-0.001591,0.963207,0.268755,-0.001591,0.999977,0.006795,-0.00004,0.999977,0.006795,-0.00004,0.999977,0.006795,-0.00004,-0.990735,0.034595,-0.131326,-0.990735,0.034595,-0.131326,-0.990735,0.034595,-0.131326,0.525119,0.851014,-0.005038,0.525119,0.851014,-0.005038,0.525119,0.851014,-0.005038,-0.997733,-0.067299,0.000398,-0.997733,-0.067299,0.000398,-0.997733,-0.067299,0.000398,0.827695,0.561169,-0.003322,0.827695,0.561169,-0.003322,0.827695,0.561169,-0.003322,0.299706,-0.954015,0.005656,0.299706,-0.954015,0.005656,0.299706,-0.954015,0.005656,0.553578,0.832783,-0.004931,0.553578,0.832783,-0.004931,0.553578,0.832783,-0.004931,-0.461423,-0.88718,0,-0.461423,-0.88718,0,-0.461423,-0.88718,0,-0.38126,-0.92442,-0.009439,-0.38126,-0.92442,-0.009439,-0.38126,-0.92442,-0.009439,-0.98982,0.142321,-0.000404,-0.98982,0.142321,-0.000404,-0.98982,0.142321,-0.000404,-0.897307,0.285782,0.336406,-0.897307,0.285782,0.336406,-0.897307,0.285782,0.336406,-0.000004,-0.999982,0.005929,-0.000004,-0.999982,0.005929,-0.000004,-0.999982,0.005929,-0.041836,-0.034235,0.998538,-0.041836,-0.034235,0.998538,-0.041836,-0.034235,0.998538,-0.086138,-0.083188,0.992804,-0.086138,-0.083188,0.992804,-0.086138,-0.083188,0.992804,-0.041836,-0.034235,-0.998538,-0.041836,-0.034235,-0.998538,-0.041836,-0.034235,-0.998538,-0.086138,-0.083188,-0.992804,-0.086138,-0.083188,-0.992804,-0.086138,-0.083188,-0.992804,-0.683751,0.666067,-0.298058,-0.683751,0.666067,-0.298058,-0.683751,0.666067,-0.298058,-0.800185,0.213306,-0.56054,-0.800185,0.213306,-0.56054,-0.800185,0.213306,-0.56054,-0.015119,0.99988,0.00332,-0.015119,0.99988,0.00332,-0.015119,0.99988,0.00332,-0.591278,0.788623,-0.168713,-0.591278,0.788623,-0.168713,-0.591278,0.788623,-0.168713,0.334014,-0.406231,-0.850536,0.334014,-0.406231,-0.850536,0.334014,-0.406231,-0.850536,-0.950009,0.312222,0,-0.950009,0.312222,0,-0.950009,0.312222,0,0.553584,0.832793,0,0.553584,0.832793,0,0.553584,0.832793,0,-0.840185,0.542296,0.0018,-0.801371,0.517244,-0.300439,-0.801371,0.517244,-0.300439,-0.801371,0.517244,-0.300439,-0.031711,-0.252222,-0.96715,-0.031711,-0.252222,-0.96715,-0.031711,-0.252222,-0.96715,0.021391,-0.026602,-0.999417,0.021391,-0.026602,-0.999417,0.021391,-0.026602,-0.999417,-0.805093,0.567838,-0.171418,-0.805093,0.567838,-0.171418,-0.805093,0.567838,-0.171418,0.982791,0.18472,0,-0.719317,-0.694682,0,-0.007006,0.463322,-0.886162,-0.00053,0.035016,-0.999387,-0.00053,0.035016,-0.999387,-0.00053,0.035016,-0.999387,-0.359131,-0.062227,-0.931211,-0.359131,-0.062227,-0.931211,-0.359131,-0.062227,-0.931211,-0.211272,0.139522,-0.967418,-0.211272,0.139522,-0.967418,-0.211272,0.139522,-0.967418,0,0,-1,0.007373,-0.003598,-0.999966,0.007373,-0.003598,-0.999966,0.007373,-0.003598,-0.999966,0.008739,0.088473,-0.99604,0.008739,0.088473,-0.99604,0.008739,0.088473,-0.99604,-0.050486,0.985017,-0.164904,-0.050486,0.985017,-0.164904,-0.050486,0.985017,-0.164904,0.924496,-0.381191,-0,0.217295,-0.089596,-0.971985,0.217295,-0.089596,-0.971985,0.217295,-0.089596,-0.971985,0.635107,-0.772424,-0,0.094373,-0.995537,-0,0.094258,-0.994321,-0.049411,0.094258,-0.994321,-0.049411,0.094258,-0.994321,-0.049411,0.552601,0.833446,0,0.552601,0.833446,0,0.552601,0.833446,0,0.525126,0.851024,0,0.525126,0.851024,0,0.525126,0.851024,0,0.999285,0.037823,0,0.999285,0.037823,0,0.999285,0.037823,0,-0.99813,-0.017505,0.058574,-0.99813,-0.017505,0.058574,-0.99813,-0.017505,0.058574,-0,-1,0,0.963207,0.268758,0.001593,0.963207,0.268758,0.001593,0.963207,0.268758,0.001593,0.999977,0.006796,0.00004,0.999977,0.006796,0.00004,0.999977,0.006796,0.00004,0.52512,0.851013,0.005038,0.52512,0.851013,0.005038,0.52512,0.851013,0.005038,0.827691,0.561174,0.003323,0.827691,0.561174,0.003323,0.827691,0.561174,0.003323,0.299706,-0.954015,-0.005656,-0.459924,-0.887955,-0.002518,-0.459924,-0.887955,-0.002518,-0.459924,-0.887955,-0.002518,-0.989821,0.142321,0.000404,-0.989821,0.142321,0.000404,-0.989821,0.142321,0.000404,-0,-0.999982,-0.005922,-0,-0.999982,-0.005922,-0,-0.999982,-0.005922,-0.394412,-0.918675,0.021791,-0.394412,-0.918675,0.021791,-0.394412,-0.918675,0.021791,-0.683751,0.666067,0.298058,-0.683751,0.666067,0.298058,-0.683751,0.666067,0.298058,-0.129207,-0.172618,0.976478,-0.129207,-0.172618,0.976478,-0.129207,-0.172618,0.976478,-0.015119,0.99988,-0.003319,-0.015119,0.99988,-0.003319,-0.015119,0.99988,-0.003319,-0.630498,0.766819,0.120249,-0.630498,0.766819,0.120249,-0.630498,0.766819,0.120249,0.334014,-0.406231,0.850536,0.334014,-0.406231,0.850536,0.334014,-0.406231,0.850536,-0.950009,0.312222,0,-0.950009,0.312222,0,-0.950009,0.312222,0,0.553584,0.832793,0,0.553584,0.832793,0,0.553584,0.832793,0,-0.840185,0.542296,-0.0018,-0.516943,0.396623,0.758591,-0.516943,0.396623,0.758591,-0.516943,0.396623,0.758591,-0.03171,-0.252222,0.96715,-0.03171,-0.252222,0.96715,-0.03171,-0.252222,0.96715,0.021391,-0.026602,0.999417,0.021391,-0.026602,0.999417,0.021391,-0.026602,0.999417,-0.805093,0.567838,0.171418,-0.805093,0.567838,0.171418,-0.805093,0.567838,0.171418,0.982791,0.18472,0,-0.719318,-0.694681,0,-0.719318,-0.694681,0,-0.719318,-0.694681,0,-0.007006,0.463322,0.886162,-0.233389,0.16669,0.95799,-0.233389,0.16669,0.95799,-0.233389,0.16669,0.95799,-0.359131,-0.062227,0.931211,-0.359131,-0.062227,0.931211,-0.359131,-0.062227,0.931211,-0.024571,0.041856,0.998821,-0.024571,0.041856,0.998821,-0.024571,0.041856,0.998821,0.007373,-0.003598,0.999966,0.007373,-0.003598,0.999966,0.007373,-0.003598,0.999966,0.008739,0.088473,0.99604,0.008739,0.088473,0.99604,0.008739,0.088473,0.99604,-0.093542,0.986766,0.132447,-0.093542,0.986766,0.132447,-0.093542,0.986766,0.132447,0.924496,-0.381191,-0,0.217295,-0.089596,0.971985,0.217295,-0.089596,0.971985,0.217295,-0.089596,0.971985,0.635107,-0.772424,-0,0.094373,-0.995537,-0,0.094258,-0.994321,0.049411,0.094258,-0.994321,0.049411,0.094258,-0.994321,0.049411,0.552601,0.833446,0,0.552601,0.833446,0,0.552601,0.833446,0,0.885191,0.033505,0.46402,0.885191,0.033505,0.46402,0.885191,0.033505,0.46402,0.999285,0.037823,0,0.999285,0.037823,0,0.999285,0.037823,0,-0.99829,-0.051481,0.027689,-0.99829,-0.051481,0.027689,-0.99829,-0.051481,0.027689,-0,-1,0,-0,-1,0,0.963207,0.268758,-0.001593,0.963207,0.268758,-0.001593,0.963207,0.268758,-0.001593,0.999977,0.006796,-0.00004,0.999977,0.006796,-0.00004,0.999977,0.006796,-0.00004,0.52512,0.851013,-0.005038,0.52512,0.851013,-0.005038,0.52512,0.851013,-0.005038,0.82769,0.561176,-0.003323,0.82769,0.561176,-0.003323,0.82769,0.561176,-0.003323,0.299706,-0.954015,0.005656,-0.394412,-0.918675,-0.021791,-0.394412,-0.918675,-0.021791,-0.394412,-0.918675,-0.021791,-0.989852,0.142105,-0.000472,-0.989852,0.142105,-0.000472,-0.989852,0.142105,-0.000472,-0,-0.999982,0.005922,-0,-0.999982,0.005922,-0,-0.999982,0.005922,-0.459924,-0.887955,0.002518,-0.459924,-0.887955,0.002518,-0.459924,-0.887955,0.002518,-0.060494,-0.001061,0.998168,-0.060494,-0.001061,0.998168,-0.060494,-0.001061,0.998168,-0.061065,0.002132,0.998132,-0.061065,0.002132,0.998132,-0.061065,0.002132,0.998132,-0.060494,-0.001061,-0.998168,-0.060494,-0.001061,-0.998168,-0.060494,-0.001061,-0.998168,-0.061065,0.002132,-0.998132,-0.061065,0.002132,-0.998132,-0.061065,0.002132,-0.998132,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0,0,0,-1,0,0,-1,0,0,-1,0,-0.95123,0.308482,0,-0.95123,0.308482,0,-0.95123,0.308482,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0,0,0,-1,0,0,-1,0,0,-1,0,0.930136,0.367216,0,0.930136,0.367216,0,0.930136,0.367216,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,-0.022358,0.929903,0.367125,-0.022358,0.929903,0.367125,-0.022358,0.929903,0.367125,1,0,0,0.959866,0,0.280459,0.959866,0,0.280459,0.959866,0,0.280459,-0.000002,0,1,-0.000002,0,1,-0.000002,0,1,-0.424939,0.905222,0,-0.424939,0.905222,0,-0.424939,0.905222,0,0.497106,0.680906,0.537822,0.497106,0.680906,0.537822,0.497106,0.680906,0.537822,0.54023,-0.605425,0.584477,0.54023,-0.605425,0.584477,0.54023,-0.605425,0.584477,-0.99448,-0.104925,0,-0.99448,-0.104925,0,-0.99448,-0.104925,0,-0.573287,-0.819354,0,-0.573287,-0.819354,0,-0.573287,-0.819354,0,0,0,1,0,0,1,0,0,1,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,-0.024036,0.999711,0,-0.024036,0.999711,0,-0.024036,0.999711,0,0.023451,-0.999725,0,0.023451,-0.999725,0,0.023451,-0.999725,0,0.000002,0,1,0.000002,0,1,0.000002,0,1,0.022308,-0.950993,0.308407,0.022308,-0.950993,0.308407,0.022308,-0.950993,0.308407,0.298624,0.954371,0,0.298624,0.954371,0,0.298624,0.954371,0,-0.287119,-0.957895,0,-0.287119,-0.957895,0,-0.287119,-0.957895,0,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0.192346,0.981327,0,0.192346,0.981327,0,0.192346,0.981327,0,0.132224,-0.99122,0,0.132224,-0.99122,0,0.132224,-0.99122,0,0,0,1,0,0,-1,0,0,-1,-0.824083,0.004439,-0.566452,-0.824083,0.004439,-0.566452,-0.824083,0.004439,-0.566452,0,0,1,0,0,-1,0,-0.95123,0.308482,-1,0,0,0,-1,0,0,1,0,0,0,1,0,0,-1,0,0.930136,0.367216,-1,0,0,1,0,0,0,-1,0,0,1,0,0,0,-1,0.959866,0,0.280458,0.959866,0,0.280458,0.959866,0,0.280458,0,0,1,0,0,1,0,0,1,-0.424938,0.905222,0,-0.424938,0.905222,0,-0.424938,0.905222,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,-0.99448,-0.104925,0,-0.573287,-0.819355,0,-0.573287,-0.819355,0,-0.573287,-0.819355,0,0,0,-1,-0.024036,0.999711,0,0.023451,-0.999725,0,0.298625,0.954371,0,0.298625,0.954371,0,0.298625,0.954371,0,-0.28712,-0.957895,0,-0.28712,-0.957895,0,-0.28712,-0.957895,0,0,0,1,0,0,-1,0.192346,0.981327,0,0.132224,-0.99122,0,-0.817295,0,-0.576219,-0.817295,0,-0.576219,-0.817295,0,-0.576219,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,0.000003,0.000001,1,0.000003,0.000001,1,0.000003,0.000001,1,-0.004335,0.044049,0.99902,-0.004335,0.044049,0.99902,-0.004335,0.044049,0.99902,-0.012846,0.042356,0.99902,-0.012846,0.042356,0.99902,-0.012846,0.042356,0.99902,-0.020864,0.039036,0.99902,-0.020864,0.039036,0.99902,-0.020864,0.039036,0.99902,-0.028075,0.034215,0.99902,-0.028075,0.034215,0.99902,-0.028075,0.034215,0.99902,-0.034213,0.02808,0.99902,-0.034213,0.02808,0.99902,-0.034213,0.02808,0.99902,-0.039034,0.020865,0.99902,-0.039034,0.020865,0.99902,-0.039034,0.020865,0.99902,-0.042354,0.012849,0.99902,-0.042354,0.012849,0.99902,-0.042354,0.012849,0.99902,-0.044047,0.00434,0.99902,-0.044047,0.00434,0.99902,-0.044047,0.00434,0.99902,-0.044047,-0.004338,0.99902,-0.044047,-0.004338,0.99902,-0.044047,-0.004338,0.99902,-0.042354,-0.012847,0.99902,-0.042354,-0.012847,0.99902,-0.042354,-0.012847,0.99902,-0.039034,-0.020865,0.99902,-0.039034,-0.020865,0.99902,-0.039034,-0.020865,0.99902,-0.034213,-0.028078,0.99902,-0.034213,-0.028078,0.99902,-0.034213,-0.028078,0.99902,-0.028078,-0.034214,0.99902,-0.028078,-0.034214,0.99902,-0.028078,-0.034214,0.99902,-0.020863,-0.039034,0.99902,-0.020863,-0.039034,0.99902,-0.020863,-0.039034,0.99902,-0.012847,-0.042355,0.99902,-0.012847,-0.042355,0.99902,-0.012847,-0.042355,0.99902,-0.004337,-0.044048,0.99902,-0.004337,-0.044048,0.99902,-0.004337,-0.044048,0.99902,0.004339,-0.044048,0.99902,0.004339,-0.044048,0.99902,0.004339,-0.044048,0.99902,0.012852,-0.042355,0.99902,0.012852,-0.042355,0.99902,0.012852,-0.042355,0.99902,0.020865,-0.039035,0.99902,0.020865,-0.039035,0.99902,0.020865,-0.039035,0.99902,0.028081,-0.034214,0.99902,0.028081,-0.034214,0.99902,0.028081,-0.034214,0.99902,0.034216,-0.028079,0.99902,0.034216,-0.028079,0.99902,0.034216,-0.028079,0.99902,0.039037,-0.020864,0.99902,0.039037,-0.020864,0.99902,0.039037,-0.020864,0.99902,0.042357,-0.012848,0.99902,0.042357,-0.012848,0.99902,0.042357,-0.012848,0.99902,0.04405,-0.004337,0.99902,0.04405,-0.004337,0.99902,0.04405,-0.004337,0.99902,0.04405,0.004339,0.99902,0.04405,0.004339,0.99902,0.04405,0.004339,0.99902,0.042356,0.01285,0.99902,0.042356,0.01285,0.99902,0.042356,0.01285,0.99902,0.039036,0.020865,0.99902,0.039036,0.020865,0.99902,0.039036,0.020865,0.99902,0.034216,0.02808,0.99902,0.034216,0.02808,0.99902,0.034216,0.02808,0.99902,0.028082,0.034215,0.99902,0.028082,0.034215,0.99902,0.028082,0.034215,0.99902,0.020866,0.039036,0.99902,0.020866,0.039036,0.99902,0.020866,0.039036,0.99902,0.00434,0.044049,0.99902,0.00434,0.044049,0.99902,0.00434,0.044049,0.99902,0.01285,0.042356,0.99902,0.01285,0.042356,0.99902,0.01285,0.042356,0.99902,0.097885,-0.993836,0.052037,0.097885,-0.993836,0.052037,0.097885,-0.993836,0.052037,0.289891,-0.955644,0.052036,0.289891,-0.955644,0.052036,0.289891,-0.955644,0.052036,0.470758,-0.880727,0.052036,0.470758,-0.880727,0.052036,0.470758,-0.880727,0.052036,0.633534,-0.771963,0.052036,0.633534,-0.771963,0.052036,0.633534,-0.771963,0.052036,0.771963,-0.633533,0.052036,0.771963,-0.633533,0.052036,0.771963,-0.633533,0.052036,0.880727,-0.470758,0.052036,0.880727,-0.470758,0.052036,0.880727,-0.470758,0.052036,0.955644,-0.289891,0.052036,0.955644,-0.289891,0.052036,0.955644,-0.289891,0.052036,0.993836,-0.097885,0.052035,0.993836,-0.097885,0.052035,0.993836,-0.097885,0.052035,0.993836,0.097884,0.052035,0.993836,0.097884,0.052035,0.993836,0.097884,0.052035,0.955644,0.289891,0.052035,0.955644,0.289891,0.052035,0.955644,0.289891,0.052035,0.880726,0.470758,0.052036,0.880726,0.470758,0.052036,0.880726,0.470758,0.052036,0.771963,0.633534,0.052036,0.771963,0.633534,0.052036,0.771963,0.633534,0.052036,0.633535,0.771962,0.052036,0.633535,0.771962,0.052036,0.633535,0.771962,0.052036,0.470759,0.880726,0.052036,0.470759,0.880726,0.052036,0.470759,0.880726,0.052036,0.289891,0.955644,0.052037,0.289891,0.955644,0.052037,0.289891,0.955644,0.052037,0.097883,0.993837,0.052037,0.097883,0.993837,0.052037,0.097883,0.993837,0.052037,-0.097883,0.993837,0.052037,-0.097883,0.993837,0.052037,-0.097883,0.993837,0.052037,-0.289892,0.955643,0.052037,-0.289892,0.955643,0.052037,-0.289892,0.955643,0.052037,-0.470758,0.880726,0.052038,-0.470758,0.880726,0.052038,-0.470758,0.880726,0.052038,-0.633534,0.771963,0.052039,-0.633534,0.771963,0.052039,-0.633534,0.771963,0.052039,-0.771964,0.633533,0.052038,-0.771964,0.633533,0.052038,-0.771964,0.633533,0.052038,-0.880725,0.470761,0.052039,-0.880725,0.470761,0.052039,-0.880725,0.470761,0.052039,-0.955645,0.289889,0.052038,-0.955645,0.289889,0.052038,-0.955645,0.289889,0.052038,-0.993836,0.097883,0.052038,-0.993836,0.097883,0.052038,-0.993836,0.097883,0.052038,-0.993836,-0.097885,0.052038,-0.993836,-0.097885,0.052038,-0.993836,-0.097885,0.052038,-0.955644,-0.289892,0.052039,-0.955644,-0.289892,0.052039,-0.955644,-0.289892,0.052039,-0.880725,-0.47076,0.052038,-0.880725,-0.47076,0.052038,-0.880725,-0.47076,0.052038,-0.771961,-0.633536,0.052038,-0.771961,-0.633536,0.052038,-0.771961,-0.633536,0.052038,-0.633533,-0.771963,0.052038,-0.633533,-0.771963,0.052038,-0.633533,-0.771963,0.052038,-0.470757,-0.880727,0.052038,-0.470757,-0.880727,0.052038,-0.470757,-0.880727,0.052038,-0.097884,-0.993836,0.052037,-0.097884,-0.993836,0.052037,-0.097884,-0.993836,0.052037,-0.28989,-0.955644,0.052037,-0.28989,-0.955644,0.052037,-0.28989,-0.955644,0.052037,-0.000002,0,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000005,-0.000002,-1,-0.000005,-0.000002,-1,-0.000005,-0.000002,-1,-0.000005,-0.000001,-1,-0.000005,-0.000001,-1,-0.000005,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000007,0.000001,-1,-0.000007,0.000001,-1,-0.000007,0.000001,-1,-0.000001,-0.000002,-1,-0.000001,-0.000002,-1,-0.000001,-0.000002,-1,-0.000001,-0.000004,-1,-0.000001,-0.000004,-1,-0.000001,-0.000004,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000002,0,-1,0,-0,-1,0,-0,-1,0,-0,-1,-0.000002,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000001,-0,-1,-0.000001,-0,-1,-0.000001,-0,-1,-0.000001,-0,-1,-0.000001,-0,-1,-0.000001,-0,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,0.000005,-0.000001,-1,0.000005,-0.000001,-1,0.000005,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000001,-0.000001,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000002,0,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0.000003,-0,1,0.000003,-0,1,0.000003,-0,1,-0.000003,-0.000004,1,-0.000003,-0.000004,1,-0.000003,-0.000004,1,0.000001,-0.000005,1,0.000001,-0.000005,1,0.000001,-0.000005,1,0,0,1,0,0,1,0,0,1,-0.000011,0.000001,1,-0.000011,0.000001,1,-0.000011,0.000001,1,0.000016,-0.000002,1,0.000016,-0.000002,1,0.000016,-0.000002,1,0,0.000004,1,0,0.000004,1,0,0.000004,1,-0.000005,-0.000001,1,-0.000005,-0.000001,1,-0.000005,-0.000001,1,0.000001,0.000002,1,0.000001,0.000002,1,0.000001,0.000002,1,0.000003,0.000005,1,0.000003,0.000005,1,0.000003,0.000005,1,0.000011,0.000004,1,0.000011,0.000004,1,0.000011,0.000004,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0.000001,1,0,0.000001,1,0,0.000001,1,0.000005,0.000003,1,0.000005,0.000003,1,0.000005,0.000003,1,0.000008,0.000005,1,0.000008,0.000005,1,0.000008,0.000005,1,0.000004,0.000002,1,0.000004,0.000002,1,0.000004,0.000002,1,0.000002,0.000001,1,0.000002,0.000001,1,0.000002,0.000001,1,0.000002,0.000001,1,0.000002,0.000001,1,0.000002,0.000001,1,-0.004338,0.044049,0.99902,-0.004338,0.044049,0.99902,-0.004338,0.044049,0.99902,0,-0.000001,1,0,-0.000001,1,0,-0.000001,1,0.000002,0.000001,1,0.000002,0.000001,1,0.000001,0,1,0.000001,0,1,0.000001,0,1,0,0.000001,1,0,0.000001,1,0,-0.000002,1,0,-0.000002,1,0,-0.000002,1,0.000002,0,1,0.000002,0,1,0.000002,0,1,0.000004,0.000001,1,0.000004,0.000001,1,0.000004,0.000001,1,0.000001,0.000001,1,0.000001,0.000001,1,0.000001,0.000001,1,-0.012848,0.042356,0.99902,-0.012848,0.042356,0.99902,-0.012848,0.042356,0.99902,0.000002,0,1,0.000002,0,1,-0.020863,0.039036,0.99902,-0.020863,0.039036,0.99902,-0.020863,0.039036,0.99902,-0.028079,0.034215,0.99902,-0.028079,0.034215,0.99902,-0.028079,0.034215,0.99902,-0.034213,0.02808,0.99902,-0.039034,0.020865,0.99902,-0.042354,0.012849,0.99902,-0.044048,0.004339,0.99902,-0.044048,0.004339,0.99902,-0.044048,0.004339,0.99902,-0.044046,-0.004338,0.99902,-0.044046,-0.004338,0.99902,-0.044046,-0.004338,0.99902,-0.042356,-0.012847,0.99902,-0.042356,-0.012847,0.99902,-0.042356,-0.012847,0.99902,-0.039033,-0.020865,0.99902,-0.039033,-0.020865,0.99902,-0.039033,-0.020865,0.99902,-0.034214,-0.028078,0.99902,-0.034214,-0.028078,0.99902,-0.034214,-0.028078,0.99902,-0.028077,-0.034214,0.99902,-0.028077,-0.034214,0.99902,-0.028077,-0.034214,0.99902,-0.020865,-0.039035,0.99902,-0.020865,-0.039035,0.99902,-0.020865,-0.039035,0.99902,-0.012848,-0.042355,0.99902,-0.012848,-0.042355,0.99902,-0.012848,-0.042355,0.99902,-0.004336,-0.044048,0.99902,-0.004336,-0.044048,0.99902,-0.004336,-0.044048,0.99902,0.00434,-0.044048,0.99902,0.00434,-0.044048,0.99902,0.00434,-0.044048,0.99902,0.012848,-0.042355,0.99902,0.012848,-0.042355,0.99902,0.012848,-0.042355,0.99902,0.020866,-0.039034,0.99902,0.020866,-0.039034,0.99902,0.020866,-0.039034,0.99902,0.02808,-0.034214,0.99902,0.02808,-0.034214,0.99902,0.02808,-0.034214,0.99902,0.034216,-0.028078,0.99902,0.034216,-0.028078,0.99902,0.034216,-0.028078,0.99902,0.039037,-0.020864,0.99902,0.042356,-0.012848,0.99902,0.042356,-0.012848,0.99902,0.042356,-0.012848,0.99902,0.04405,-0.004338,0.99902,0.04405,-0.004338,0.99902,0.04405,-0.004338,0.99902,0.04405,0.004339,0.99902,0.042357,0.01285,0.99902,0.042357,0.01285,0.99902,0.042357,0.01285,0.99902,0.039037,0.020865,0.99902,0.039037,0.020865,0.99902,0.039037,0.020865,0.99902,0.034216,0.02808,0.99902,0.028079,0.034215,0.99902,0.028079,0.034215,0.99902,0.028079,0.034215,0.99902,0.020866,0.039036,0.99902,0.00434,0.044049,0.99902,0.01285,0.042356,0.99902,0.097884,-0.993836,0.052037,0.097884,-0.993836,0.052037,0.097884,-0.993836,0.052037,0.289891,-0.955644,0.052036,0.470758,-0.880726,0.052036,0.470758,-0.880726,0.052036,0.470758,-0.880726,0.052036,0.633534,-0.771963,0.052036,0.771963,-0.633534,0.052036,0.771963,-0.633534,0.052036,0.771963,-0.633534,0.052036,0.880727,-0.470757,0.052035,0.880727,-0.470757,0.052035,0.880727,-0.470757,0.052035,0.955644,-0.289891,0.052036,0.993837,-0.097885,0.052036,0.993837,-0.097885,0.052036,0.993837,-0.097885,0.052036,0.993837,0.097884,0.052035,0.993837,0.097884,0.052035,0.993837,0.097884,0.052035,0.955644,0.289892,0.052036,0.955644,0.289892,0.052036,0.955644,0.289892,0.052036,0.880726,0.470758,0.052036,0.771963,0.633534,0.052036,0.633534,0.771963,0.052037,0.633534,0.771963,0.052037,0.633534,0.771963,0.052037,0.470757,0.880727,0.052037,0.470757,0.880727,0.052037,0.470757,0.880727,0.052037,0.289892,0.955644,0.052037,0.289892,0.955644,0.052037,0.289892,0.955644,0.052037,0.097884,0.993836,0.052037,0.097884,0.993836,0.052037,0.097884,0.993836,0.052037,-0.097885,0.993836,0.052037,-0.097885,0.993836,0.052037,-0.097885,0.993836,0.052037,-0.289891,0.955644,0.052038,-0.289891,0.955644,0.052038,-0.289891,0.955644,0.052038,-0.470759,0.880726,0.052037,-0.470759,0.880726,0.052037,-0.470759,0.880726,0.052037,-0.633535,0.771962,0.052038,-0.633535,0.771962,0.052038,-0.633535,0.771962,0.052038,-0.771963,0.633534,0.052038,-0.771963,0.633534,0.052038,-0.771963,0.633534,0.052038,-0.880727,0.470756,0.052038,-0.880727,0.470756,0.052038,-0.880727,0.470756,0.052038,-0.955644,0.28989,0.052039,-0.955644,0.28989,0.052039,-0.955644,0.28989,0.052039,-0.993836,0.097885,0.052038,-0.993836,0.097885,0.052038,-0.993836,0.097885,0.052038,-0.993836,-0.097885,0.052038,-0.955643,-0.289893,0.052038,-0.955643,-0.289893,0.052038,-0.955643,-0.289893,0.052038,-0.880726,-0.470758,0.052039,-0.880726,-0.470758,0.052039,-0.880726,-0.470758,0.052039,-0.771963,-0.633534,0.052038,-0.771963,-0.633534,0.052038,-0.771963,-0.633534,0.052038,-0.633533,-0.771964,0.052038,-0.633533,-0.771964,0.052038,-0.633533,-0.771964,0.052038,-0.470757,-0.880727,0.052037,-0.470757,-0.880727,0.052037,-0.470757,-0.880727,0.052037,-0.097883,-0.993836,0.052037,-0.097883,-0.993836,0.052037,-0.097883,-0.993836,0.052037,-0.289889,-0.955644,0.052037,-0.289889,-0.955644,0.052037,-0.289889,-0.955644,0.052037,-0,1,-0.000001,-0.19509,0.980785,-0,-0.19509,0.980785,-0,-0.19509,0.980785,-0,-0.382683,0.92388,-0,-0.382683,0.92388,-0,-0.382683,0.92388,-0,-0.382683,0.92388,-0,-0.55557,0.83147,0,-0.55557,0.83147,0,-0.707107,0.707107,0.000001,-0.707107,0.707107,0.000001,-0.707107,0.707107,0.000001,-0.83147,0.55557,0.000001,-0.83147,0.55557,0.000001,-0.83147,0.55557,0.000001,-0.92388,0.382683,0.000001,-0.92388,0.382683,0.000001,-0.92388,0.382683,0.000001,-0.980785,0.19509,0.000001,-0.980785,0.19509,0.000001,-0.980785,0.19509,0.000001,-1,0,0.000002,-1,0,0.000002,-1,0,0.000002,-1,0,0.000002,-0.980785,-0.19509,0.000002,-0.980785,-0.19509,0.000002,-0.92388,-0.382683,0.000002,-0.92388,-0.382683,0.000002,-0.92388,-0.382683,0.000002,-0.92388,-0.382683,0.000002,-0.83147,-0.55557,0.000002,-0.83147,-0.55557,0.000002,-0.707107,-0.707107,0.000002,-0.707107,-0.707107,0.000002,-0.707107,-0.707107,0.000002,-0.55557,-0.83147,0.000002,-0.55557,-0.83147,0.000002,-0.55557,-0.83147,0.000002,-0.55557,-0.83147,0.000002,-0.382683,-0.92388,0.000001,-0.382683,-0.92388,0.000001,-0.382683,-0.92388,0.000001,-0.19509,-0.980785,0.000001,-0.19509,-0.980785,0.000001,0,-1,0.000001,0,-1,0.000001,0,-1,0.000001,0.195091,-0.980785,0,0.195091,-0.980785,0,0.195091,-0.980785,0,0.382684,-0.923879,0,0.382684,-0.923879,0,0.382684,-0.923879,0,0.382684,-0.923879,0,0.55557,-0.83147,-0,0.555571,-0.831469,-0,0.55557,-0.83147,-0,0.707107,-0.707107,-0.000001,0.707107,-0.707107,-0.000001,0.83147,-0.55557,-0.000001,0.83147,-0.55557,-0.000001,0.83147,-0.55557,-0.000001,0.92388,-0.382683,-0.000001,0.92388,-0.382683,-0.000001,0.92388,-0.382683,-0.000001,0.980785,-0.195089,-0.000001,0.980785,-0.19509,-0.000001,0.980785,-0.195089,-0.000001,1,0.000002,-0.000001,1,0.000001,-0.000002,1,0.000002,-0.000001,0.980785,0.195092,-0.000002,0.980785,0.195091,-0.000002,0.980785,0.195091,-0.000002,0.980785,0.195092,-0.000002,0.923879,0.382685,-0.000002,0.923879,0.382685,-0.000002,0.831469,0.555571,-0.000002,0.831469,0.555571,-0.000002,0.831469,0.555571,-0.000002,0.831469,0.555571,-0.000002,0.707106,0.707107,-0.000002,0.707106,0.707107,-0.000002,0.555569,0.83147,-0.000001,0.555569,0.83147,-0.000001,0.555569,0.83147,-0.000001,0.555569,0.83147,-0.000001,0.382682,0.92388,-0.000001,0.195089,0.980785,-0.000001,-0,1,-0.000001,-0,1,-0.000001,0.382682,0.92388,-0.000001,0.382682,0.92388,-0.000001,0.195089,0.980785,-0.000001,-0,1,-0.000001,-0.19509,0.980785,-0,-0.55557,0.83147,0,-0.55557,0.83147,0,-0.707107,0.707107,0.000001,-0.83147,0.55557,0.000001,-0.92388,0.382683,0.000001,-0.980785,0.19509,0.000001,-0.980785,-0.19509,0.000002,-0.980785,-0.19509,0.000002,-0.83147,-0.55557,0.000002,-0.83147,-0.55557,0.000002,-0.707107,-0.707107,0.000002,-0.382683,-0.92388,0.000001,-0.19509,-0.980785,0.000001,-0.19509,-0.980785,0.000001,0,-1,0.000001,0.195091,-0.980785,0,0.555571,-0.831469,-0,0.707107,-0.707106,-0.000001,0.707107,-0.707106,-0.000001,0.83147,-0.55557,-0.000001,0.92388,-0.382683,-0.000001,0.980785,-0.19509,-0.000001,1,0.000001,-0.000002,0.92388,0.382683,-0.000002,0.92388,0.382683,-0.000002,0.707106,0.707108,-0.000002,0.707106,0.707108,-0.000002,0.382682,0.92388,-0.000001,0.195089,0.980785,-0.000001,0.195089,0.980785,-0.000001,-1,0,0,-1,0,0,-1,0,0,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,-0.95123,-0.308482,0,-0.95123,-0.308482,0,-0.95123,-0.308482,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,0.930136,-0.367216,0,0.930136,-0.367216,0,0.930136,-0.367216,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0.497039,0.807105,-0.318643,0.497039,0.807105,-0.318643,0.497039,0.807105,-0.318643,0.959866,0,-0.280459,0.959866,0,-0.280459,0.959866,0,-0.280459,0,0,-1,0,0,-1,0,0,-1,-0.289019,0.957323,0,-0.289019,0.957323,0,-0.289019,0.957323,0,0.497106,0.680907,-0.537821,0.497106,0.680907,-0.537821,0.497106,0.680907,-0.537821,0,-1,0,0,-1,0,0,-1,0,-0.999177,0.040562,0,-0.999177,0.040562,0,-0.999177,0.040562,0,-0.686165,-0.727446,0,-0.686165,-0.727446,0,-0.686165,-0.727446,0,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,0,0,1,0,0,1,0,0,1,0.524374,0.851488,0,0.524374,0.851488,0,0.524374,0.851488,0,-0.410078,-0.91205,0,-0.410078,-0.91205,0,-0.410078,-0.91205,0,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,-0.393239,-0.874596,-0.28363,-0.393239,-0.874596,-0.28363,-0.393239,-0.874596,-0.28363,0.434014,0.900906,0,0.434014,0.900906,0,0.434014,0.900906,0,-0.423142,-0.906063,0,-0.423142,-0.906063,0,-0.423142,-0.906063,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0.332775,0.943006,0,0.332775,0.943006,0,0.332775,0.943006,0,-0.013079,-0.999914,0,-0.013079,-0.999914,0,-0.013079,-0.999914,0,0,0,-1,-0.717511,0,0.696547,-0.717511,0,0.696547,-0.717511,0,0.696547,0,0,-1,0,0,1,0,-0.95123,-0.308482,-1,0,0,1,0,0,0,-1,0,0,1,0,0,0,-1,0,0,1,0,0.930136,-0.367216,-1,0,0,1,0,0,0,-1,0,0,1,0,0,0,1,0.959866,0,-0.28046,0.959866,0,-0.28046,0.959866,0,-0.28046,0,0,-1,-0.289019,0.957323,0,0,1,0,0,1,0,0,1,0,0.540229,-0.605426,-0.584477,0.540229,-0.605426,-0.584477,0.540229,-0.605426,-0.584477,-0.999177,0.040562,0,-0.686166,-0.727445,0,-0.686166,-0.727445,0,-0.686166,-0.727445,0,0,0,-1,0,0,-1,0,0,1,0.524372,0.851489,0,0.524372,0.851489,0,0.524372,0.851489,0,-0.410079,-0.91205,0,-0.410079,-0.91205,0,-0.410079,-0.91205,0,0,0,-1,0,0,-1,0,0,-1,0.434013,0.900906,0,0.434013,0.900906,0,0.434013,0.900906,0,-0.423142,-0.906063,0,0,0,1,0.332774,0.943006,0,0.332774,0.943006,0,0.332774,0.943006,0,-0.013079,-0.999915,0,-0.013079,-0.999915,0,-0.013079,-0.999915,0,-0.540869,0.082341,0.837067,-0.540869,0.082341,0.837067,-0.540869,0.082341,0.837067,-0.862678,-0.505753,0,-0.862678,-0.505753,0,-0.862678,-0.505753,0,0,-0.257931,-0.966163,0,-0.257931,-0.966163,0,-0.257931,-0.966163,0.833403,-0.552666,0,0.833403,-0.552666,0,0.833403,-0.552666,0,0,-0.221293,0.975207,0,-0.221293,0.975207,0,-0.221293,0.975207,0,-1,0,0,-1,0,0,-1,0,-0.996724,-0.080877,0.000462,-0.996724,-0.080877,0.000462,-0.996724,-0.080877,0.000462,0.973502,-0.228676,-0.000002,0.973502,-0.228676,-0.000002,0.973502,-0.228676,-0.000002,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-0.862679,-0.505753,0,-0.862679,-0.505753,0,-0.862679,-0.505753,0,0,-0.257931,-0.966163,0.833403,-0.552666,0,0,-0.221294,0.975207,0,-0.221294,0.975207,0,-0.221294,0.975207,0,-1,0,-0.996648,-0.081742,-0.003213,-0.996648,-0.081742,-0.003213,-0.996648,-0.081742,-0.003213,-0.996737,-0.080724,-0.000128,-0.996737,-0.080724,-0.000128,-0.996737,-0.080724,-0.000128,-0.99674,-0.080677,0.000108,-0.99674,-0.080677,0.000108,-0.99674,-0.080677,0.000108,-0.996723,-0.080877,0.001117,-0.996723,-0.080877,0.001117,-0.996723,-0.080877,0.001117,-0.996648,-0.081743,-0.003216,-0.996648,-0.081743,-0.003216,-0.996648,-0.081743,-0.003216,-0.996737,-0.080724,-0.000128,-0.996737,-0.080724,-0.000128,-0.996737,-0.080724,-0.000128,-0.99674,-0.080677,0.000109,-0.99674,-0.080677,0.000109,-0.99674,-0.080677,0.000109,-0.996723,-0.080877,0.001116,-0.996723,-0.080877,0.001116,-0.996723,-0.080877,0.001116,-0.996736,-0.080724,-0.000308,-0.996736,-0.080724,-0.000308,-0.996736,-0.080724,-0.000308,-0.996737,-0.080724,-0.000309,-0.996737,-0.080724,-0.000309,-0.996737,-0.080724,-0.000309,-0.99674,-0.080677,0,-0.99674,-0.080677,0,-0.99674,-0.080677,0,-0.996724,-0.080877,0.000462,-0.996724,-0.080877,0.000462,-0.996724,-0.080877,0.000462,0.973393,-0.2117,0.087689,0.973393,-0.2117,0.087689,0.973393,-0.2117,0.087689,-0.99674,-0.080677,0,0.973502,-0.228679,0.000004,0.973502,-0.228679,0.000004,0.973502,-0.228679,0.000004,0.973502,-0.228677,0,0.973502,-0.228677,0,0.973502,-0.228677,0,0.973395,-0.211692,-0.087688,0.973395,-0.211692,-0.087688,0.973395,-0.211692,-0.087688,0.973502,-0.228677,0,0.973502,-0.228677,0,0.973502,-0.228677,0,0.973502,-0.22868,0.000002,0.973502,-0.22868,0.000002,0.973502,-0.22868,0.000002,0.973502,-0.228677,0,0.996164,-0.08751,0,0.996164,-0.08751,0,0.996164,-0.08751,0,0.996163,-0.087515,-0,0.996163,-0.087515,-0,0.996163,-0.087515,-0,0.973503,-0.228676,-0.000001,0.973503,-0.228676,-0.000001,0.973503,-0.228676,-0.000001,0.973503,-0.228675,0,0.973503,-0.228675,0,0.973503,-0.228675,0,0.973503,-0.228676,0,0.973503,-0.228676,0,0.973503,-0.228676,0,0.973502,-0.228678,0,0.973502,-0.228678,0,0.973502,-0.228678,0,0,0,1,-0.774652,-0.632388,-0.000001,-0.980773,-0.195074,0,-0.980785,-0.195092,-0,-0.195084,-0.980787,-0.000001,-0.195084,-0.980787,-0.000001,-0.956938,0.290262,0,-0.707083,0.707083,0,-0.70711,0.707104,0.000001,-0.195074,0.980773,0,-0.195092,0.980785,0.000001,-0.90085,0.27327,0.337331,-0.539018,0.539018,0.647206,-0.707083,0.707083,0,-0.148717,0.747642,0.647206,-0.195074,0.980773,0,0.980773,-0.195074,0,0.774655,-0.632384,-0.000001,0.707106,-0.707107,-0,0.290289,-0.956939,-0.000001,0.707107,0.707107,0.000001,0.707083,0.707083,0,0.956938,0.290262,0,0.290262,0.956938,0,0.707083,0.707083,0,0.539018,0.539018,0.647206,0.721512,0.385662,0.575053,0.290262,0.956938,0,0.21659,0.714042,0.6657,0.290289,-0.956939,-0.000001,0.29029,0.956939,0,0,0,1,0.956939,0.29029,0.000001,-0.995184,0.098021,0,-0.956938,0.290262,0,-0.881918,-0.471402,-0,-0.995436,-0.09543,-0,0.980785,-0.195091,-0,0.881919,-0.471402,-0.000001,0.935637,0.352965,0.000001,-0.707101,-0.707112,-0.000001,-0.980785,-0.195091,0.000001,-0.980773,-0.195074,0,-0.774652,-0.632388,-0,-0.195085,-0.980786,0,-0.195085,-0.980786,0,-0.935639,0.352958,0,-0.707083,0.707083,0,-0.539018,0.539018,-0.647206,-0.195074,0.980773,0,-0.148717,0.747642,-0.647206,-0.721516,0.385656,-0.575052,-0.95694,0.290285,0.000001,-0.70711,0.707103,0.000002,-0.707083,0.707083,0,-0.195092,0.980785,0.000002,-0.195074,0.980773,0,0.980785,-0.195091,-0.000001,0.707106,-0.707108,-0.000001,0.707107,-0.707107,-0.000001,0.290289,-0.956939,-0,0.539018,0.539018,-0.647206,0.707083,0.707083,0,0.935637,0.352964,0.000001,0.290262,0.956938,0,0.21659,0.714042,-0.6657,0.721512,0.385663,-0.575051,0.707083,0.707083,0,0.707107,0.707106,0,0.956939,0.290289,-0.000001,0.290262,0.956938,0,0.29029,-0.956939,0,-0,0.000001,-1,0.29029,0.956939,0.000001,-0.956938,0.290262,0,0.956938,0.290262,0,-0.881918,-0.471403,-0,0.995436,-0.09543,-0.000001,0.995184,0.098021,0,-0.040156,0.508125,-0.860347,-0.047187,0.588176,-0.807355,0.10062,0.673727,-0.732078,-0.400708,0.91467,-0.052736,-0.153172,0.977233,0.14658,-0.078066,0.989135,-0.124424,-0.497773,0.840483,-0.214033,-0.215369,0.875149,-0.433241,-0.429017,0.81314,-0.39338,-0.44929,0.634211,-0.629218,-0.327829,0.755762,-0.56688,-0.227915,0.721948,-0.653334,0.050813,0.874752,-0.481857,0.146245,0.978545,-0.145024,0.32442,0.302605,-0.896204,0.236007,0.411495,-0.880325,0.419019,0.471572,-0.775903,0.323649,0.872097,-0.366955,0.503403,0.651845,-0.567125,0.592547,0.798517,-0.105899,0.73577,0.290479,-0.611771,0.42094,0.321779,-0.848096,0.691671,0.621662,-0.367504,0.803369,0.12566,0.582072,0.841095,0.135023,0.523764,0.87521,0.292276,0.385388,0.881679,0.125612,-0.454822,0.908231,0.300974,-0.290628,0.881802,0.471572,-0.005097,0.391064,0.91998,0.026002,0.98478,0.111926,-0.13297,0.983865,0.145545,0.104045,0.114933,0.980285,0.160527,0.724448,0.622211,0.296609,0.40791,0.871487,0.272225,0.260421,0.451941,0.853188,0.544328,0.489578,0.681143,0.478347,0.704337,0.52443,0.116459,0.8811,0.458327,0.456179,0.316658,0.831642,0.171728,0.636219,0.752129,-0.090701,0.572767,0.814685,-0.044842,0.503339,0.862925,-0.328295,0.65628,0.679351,-0.299525,0.662082,0.686973,-0.156713,0.779778,0.606098,-0.315256,0.890652,0.327525,-0.408146,0.804297,0.431883,-0.319352,0.768718,0.554155,-0.495926,0.804622,0.326558,-0.54042,0.834161,0.110102,0.997589,-0.04907,-0.049069,-0.702617,0.707722,-0.07389,-0.01771,0.522989,-0.852155,0.797778,0.006501,-0.602917,0.7376,0.238655,0.631657,0.315668,0.202897,0.926923,-0.05632,0.527952,0.847404,-0.356426,0.661336,-0.659963,0.042909,0.653249,-0.755913,-0.09827,0.434034,-0.895505,0.456343,0.648183,-0.609546,0.716788,0.648518,-0.256081,0.973846,-0.225105,-0.029756,0.740349,0.643178,0.195379,0.517869,0.640919,0.566546,0.267708,-0.379833,0.885433,0.108493,0.643391,0.757775,-0.330424,0.640797,0.692923,-0.653615,0.644948,0.395978,-0.782525,-0.096896,0.614978,-0.765465,0.64153,-0.049837,-0.63683,0.64922,-0.415845,0.431349,-0.268471,-0.861293,-0.964873,-0.189611,-0.181646,-0.806726,-0.588916,0.048189,-0.633747,0.245949,-0.73336,-0.255104,0.252022,-0.93347,-0.028657,-0.999542,-0.007874,0.323344,-0.903195,-0.282205,0.162236,0.054811,-0.985198,0.489914,-0.633442,-0.598895,-0.446699,-0.887204,0.115329,-0.880703,0.09592,-0.46379,-0.000977,-0.985626,0.168889,-0.000183,-0.956969,0.29017,-0.001373,-0.951048,0.308969,0.00058,-0.884884,0.465773,-0.000153,-0.877804,0.478957,0.000992,-0.956307,0.292362,0.000549,-0.769616,0.638478,0.001037,-0.999999,0,0.000733,-0.707106,0.707107,0.00021,-0.561525,0.82746,0.000962,-0.927469,0.373898,0.000424,-0.617383,0.786663,0,0,1,0,0,1,0,0,1,-0.000397,-0.285073,0.958495,-0.000031,-0.283822,0.958861,-0.000061,-0.085574,0.996307,-0.000214,-0.092441,0.995697,0.000305,0.113071,0.993561,0.000427,0.10239,0.99472,0.001134,0.28591,0.958256,0.000793,0.760765,0.648976,0.001022,0.980779,-0.195118,0.001955,0.827197,-0.561908,0,0.685643,0.727938,0,0.876085,0.482158,0,0.81943,0.573179,0.002838,0.974731,0.223243,-0.002441,-0.983093,0.18302,0,0.983855,-0.178965,0,0.876082,-0.482162,0,0.81943,-0.573179,0.001022,0.98078,0.195114,0.001954,0.827197,0.561909,0.000671,0.626026,0.779778,0.003677,0.927059,0.374898,0.002167,0.942656,0.33372,0.000671,0.291116,0.956664,0.004242,0.97824,0.207282,-0.000061,-0.467116,0.884182,0,0.685645,-0.727936,0,0.983856,0.178962,0,0.980785,-0.195092,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0.000519,0.46791,0.883755,0,0,1,0,0,1,0,0,1,0.000977,0.867641,0.497116,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-0.707101,-0.707112,-0.000001,-0.95694,0.290286,0,0.980785,-0.195092,0,0,0,1,-0,0.000001,-1,-0.980785,-0.195092,-0,-0.605688,0.726865,0.323742,-0.659097,0.749251,-0.064916,0.000001,0.980786,0.195088,0,0,1,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,-1,0,0,1,0,0,0,-1,0,0,1,0,0,0,-1,1,0,0,0,0,1,0,-1,0,0,1,0,-1,0,0,0,0,-1,1,0,0,0,0,1,0,-1,0,0,1,0,-1,0,0,0,0,-1,1,0,0,0,0,1,0,-1,0,0,1,0,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,0,-0.000002,-1,0,-0.000002,-1,0,-0.000002,-1,0.000001,-0.000001,-1,0.000001,-0.000001,-1,0.000001,-0.000001,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,-0.000001,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000002,-1,0,-0.000002,-1,0,-0.000002,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0,-1,0,-0,-1,0,-0,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,-0.000002,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0,0,1,0,0,1,0,0,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0.000001,0.000001,1,-0.000001,0.000001,1,-0.000001,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0.000002,0.000001,1,-0.000002,0.000001,1,-0.000002,0.000001,1,0.000005,0,1,0.000005,0,1,0.000005,0,1,0.000001,0,1,0.000001,0,1,0.000001,0,1,0,0,1,0,0,1,0,0,1,-0.000002,0,1,-0.000002,0,1,-0.000002,0,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,0.000001,0.000001,1,0.000001,0.000001,1,0.000001,0.000001,1,0.000005,0.000001,1,0.000005,0.000001,1,0.000005,0.000001,1,0.000004,0,1,0.000004,0,1,0.000004,0,1,-0.000002,0,1,-0.000002,0,1,-0.000002,0,1,0.000004,0.000003,1,0.000004,0.000003,1,0.000004,0.000003,1,-0.000003,0.000001,1,-0.000003,0.000001,1,-0.000003,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0.000001,0,1,-0.000001,0,1,-0.000001,0,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,-0,0.000001,1,0,0,1,0.000001,0.000001,1,0.000001,0.000001,1,0.000001,0.000001,1,-0,0.000001,1,0.000001,0.000001,1,0,-1,0.000001,0.195091,-0.980785,0,0.19509,-0.980785,0.000001,0.19509,-0.980785,0.000001,0.195091,-0.980785,0,0.382683,-0.92388,0.000001,0.382683,-0.92388,0.000001,0.55557,-0.83147,0.000001,0.55557,-0.83147,0.000001,0.55557,-0.83147,0.000001,0.707107,-0.707107,0,0.707107,-0.707106,0.000001,0.707107,-0.707107,0,0.831469,-0.555571,0,0.83147,-0.55557,0.000001,0.83147,-0.55557,0.000001,0.831469,-0.555571,0,0.923879,-0.382684,0,0.923879,-0.382684,0,0.980785,-0.195091,0,0.980785,-0.195089,0,0.980785,-0.195091,0,1,-0.000001,-0,1,-0,0,1,-0,0,1,-0.000001,-0,0.980785,0.19509,-0,0.980785,0.19509,-0,0.92388,0.382683,-0,0.923879,0.382684,-0,0.92388,0.382683,-0,0.83147,0.555569,-0.000001,0.831469,0.555571,-0,0.83147,0.555569,-0.000001,0.707107,0.707107,-0.000001,0.707107,0.707107,-0,0.707107,0.707107,-0.000001,0.55557,0.83147,-0.000001,0.555571,0.831469,-0,0.55557,0.83147,-0.000001,0.382683,0.92388,-0.000001,0.382684,0.923879,-0,0.382683,0.92388,-0.000001,0.19509,0.980785,-0.000001,0.19509,0.980785,-0,0.19509,0.980785,-0.000001,-0,1,-0.000001,-0,1,-0,-0,1,-0.000001,-0.195091,0.980785,-0.000001,-0.195091,0.980785,-0.000001,-0.195091,0.980785,-0.000001,-0.382684,0.923879,-0,-0.382684,0.923879,-0.000001,-0.382684,0.923879,-0,-0.555571,0.831469,-0,-0.555571,0.831469,-0.000001,-0.555571,0.831469,-0,-0.707107,0.707106,-0.000001,-0.707107,0.707106,-0,-0.707107,0.707106,-0,-0.707107,0.707106,-0.000001,-0.83147,0.55557,-0.000001,-0.83147,0.55557,-0.000001,-0.92388,0.382683,-0,-0.923881,0.38268,-0,-0.92388,0.382683,-0,-0.980785,0.19509,-0,-0.980786,0.195088,-0,-0.980785,0.19509,-0,-1,0.000001,0,-1,-0.000001,-0,-1,0.000001,0,-0.980785,-0.195091,0,-0.980785,-0.195091,0,-0.980785,-0.195091,0,-0.980785,-0.195091,0,-0.923879,-0.382685,0,-0.923879,-0.382685,0,-0.831469,-0.555571,0.000001,-0.831468,-0.555573,0,-0.831469,-0.555571,0.000001,-0.707105,-0.707108,0,-0.707106,-0.707108,0.000001,-0.707105,-0.707108,0,-0.555568,-0.831471,0,-0.555569,-0.83147,0.000001,-0.555568,-0.831471,0,-0.382683,-0.92388,0,-0.382682,-0.92388,0.000001,-0.195089,-0.980786,0.000001,-0.195089,-0.980786,0,0,-1,0.000001,-0.382683,-0.92388,0,-0.195089,-0.980786,0,-0.195089,-0.980786,0.000001,0,-1,0.000001,0.382683,-0.92388,0.000001,0.382683,-0.92388,0.000001,0.55557,-0.83147,0.000001,0.707107,-0.707106,0.000001,0.92388,-0.382683,0,0.92388,-0.382683,0,0.980785,-0.195089,0,0.980785,0.19509,-0,0.980785,0.19509,-0,0.923879,0.382684,-0,0.831469,0.555571,-0,0.707107,0.707107,-0,0.555571,0.831469,-0,0.382684,0.923879,-0,0.19509,0.980785,-0,-0,1,-0,-0.195091,0.980785,-0.000001,-0.382684,0.923879,-0.000001,-0.555571,0.831469,-0.000001,-0.831471,0.555569,-0,-0.831471,0.555569,-0,-0.923881,0.38268,-0,-0.980786,0.195088,-0,-1,-0.000001,-0,-0.923879,-0.382685,0,-0.923879,-0.382685,0,-0.831468,-0.555573,0,-0.707106,-0.707108,0.000001,-0.555569,-0.83147,0.000001,0,-1,0.000001,-0.382682,-0.92388,0.000001,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0.000002,-0.000001,1,-0.000002,-0.000001,1,-0.000002,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0,-0,1,0,-0,1,0,-0,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,0,-0,1,0,-0,1,0,-0,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,0,-0.000002,1,0,-0.000002,1,0,-0.000002,1,0,0.000001,-1,0,0.000001,-1,0.000002,0,-1,0.000002,0,-1,0.000002,0,-1,-0.000005,0.000001,-1,-0.000005,0.000001,-1,-0.000005,0.000001,-1,0.000004,0.000001,-1,0.000004,0.000001,-1,0.000004,0.000001,-1,-0.000002,0.000003,-1,-0.000002,0.000003,-1,-0.000002,0.000003,-1,-0.000003,0.000001,-1,-0.000003,0.000001,-1,-0.000003,0.000001,-1,0.000006,0,-1,0.000006,0,-1,0.000006,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,-0.000004,0.000001,-1,-0.000004,0.000001,-1,-0.000004,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0.000001,0.000001,-1,0.000001,0.000001,-1,0.000001,0.000001,-1,0,0.000001,-1,-0.000002,0.000001,-1,-0.000002,0.000001,-1,-0.000002,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000002,-1,0,0.000002,-1,0,0.000002,-1,0.000001,0.000001,-1,0.000001,0.000001,-1,-0.000001,0.000001,-1,-0.000001,0.000001,-1,-0.000001,0.000001,-1,0.000004,0.000003,-1,0.000004,0.000003,-1,0.000004,0.000003,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,-0.000001,0.000001,-1,-0.000001,0.000001,-1,-0.000001,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,0.000001,-1,0,1,0.000001,0.195091,0.980785,0.000001,0.19509,0.980785,0,0.195091,0.980785,0.000001,0.382684,0.923879,0.000001,0.382683,0.92388,0,0.382683,0.92388,0,0.382684,0.923879,0.000001,0.555571,0.831469,0,0.555571,0.831469,0,0.707107,0.707107,0,0.707107,0.707107,0,0.707107,0.707107,0,0.831469,0.555571,0,0.83147,0.55557,0,0.831469,0.555571,0,0.923879,0.382684,0,0.92388,0.382682,0,0.923879,0.382684,0,0.980785,0.195091,0,0.980786,0.195089,0,0.980785,0.195091,0,1,0.000001,-0,1,0,-0,1,0,-0,1,0.000001,-0,0.980785,-0.19509,-0,0.980785,-0.19509,-0,0.980785,-0.19509,-0,0.92388,-0.382684,-0,0.92388,-0.382684,-0,0.83147,-0.55557,-0,0.831469,-0.555571,-0.000001,0.83147,-0.55557,-0,0.707107,-0.707106,-0,0.707106,-0.707107,-0.000001,0.707106,-0.707107,-0.000001,0.707107,-0.707106,-0,0.55557,-0.831469,-0.000001,0.55557,-0.831469,-0.000001,0.382683,-0.92388,-0,0.382684,-0.923879,-0.000001,0.382683,-0.92388,-0,0.195089,-0.980785,-0,0.19509,-0.980785,-0.000001,0.195089,-0.980785,-0,0,-1,-0.000001,0,-1,-0.000001,0,-1,-0.000001,-0.195091,-0.980785,-0.000001,-0.195091,-0.980785,-0.000001,-0.195091,-0.980785,-0.000001,-0.382684,-0.92388,-0.000001,-0.382685,-0.923879,-0.000001,-0.382684,-0.92388,-0.000001,-0.555571,-0.831469,-0.000001,-0.555571,-0.831469,-0.000001,-0.555571,-0.831469,-0.000001,-0.555571,-0.831469,-0.000001,-0.707107,-0.707107,-0.000001,-0.707107,-0.707107,-0.000001,-0.831469,-0.555571,-0,-0.83147,-0.555569,-0.000001,-0.831469,-0.555571,-0,-0.92388,-0.382683,-0,-0.92388,-0.382682,-0,-0.92388,-0.382683,-0,-0.980786,-0.195089,-0,-0.980786,-0.195089,-0,-0.980786,-0.195089,-0,-1,0.000001,-0,-1,0,0,-1,0.000001,-0,-0.980785,0.195091,0,-0.980785,0.195091,0,-0.980785,0.195091,0,-0.92388,0.382683,0,-0.923878,0.382686,0,-0.92388,0.382683,0,-0.831469,0.555571,0,-0.831469,0.555572,0,-0.831469,0.555572,0,-0.831469,0.555571,0,-0.707105,0.707108,0,-0.707107,0.707107,0,-0.707105,0.707108,0,-0.555569,0.83147,0,-0.555569,0.83147,0,-0.382682,0.92388,0.000001,-0.382682,0.92388,0,-0.195089,0.980785,0.000001,-0.19509,0.980785,0.000001,0,1,0.000001,-0.382682,0.92388,0.000001,-0.19509,0.980785,0.000001,-0.195089,0.980785,0.000001,0,1,0.000001,0.19509,0.980785,0,0.55557,0.83147,0,0.55557,0.83147,0,0.707107,0.707107,0,0.83147,0.55557,0,0.92388,0.382682,0,0.980786,0.195089,0,0.980785,-0.19509,-0,0.923879,-0.382684,-0,0.923879,-0.382684,-0,0.831469,-0.555571,-0.000001,0.55557,-0.83147,-0.000001,0.55557,-0.83147,-0.000001,0.382684,-0.923879,-0.000001,0.19509,-0.980785,-0.000001,0,-1,-0.000001,-0.195091,-0.980785,-0.000001,-0.382685,-0.923879,-0.000001,-0.707107,-0.707106,-0,-0.707107,-0.707106,-0,-0.83147,-0.555569,-0.000001,-0.92388,-0.382682,-0,-0.980786,-0.195089,-0,-1,0,0,-0.980785,0.195091,0,-0.923878,0.382686,0,-0.707107,0.707107,0,-0.555569,0.83147,0,-0.555569,0.83147,0,-0.382682,0.92388,0,0,1,0.000001,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0,0.000001,-1,-0,0.000001,-1,-0,0.000001,-1,0.004339,0.044049,-0.99902,0.004339,0.044049,-0.99902,0.004339,0.044049,-0.99902,0.012849,0.042356,-0.99902,0.012849,0.042356,-0.99902,0.012849,0.042356,-0.99902,0.020865,0.039036,-0.99902,0.020865,0.039036,-0.99902,0.020865,0.039036,-0.99902,0.028079,0.034215,-0.99902,0.028079,0.034215,-0.99902,0.028079,0.034215,-0.99902,0.034216,0.02808,-0.99902,0.034216,0.02808,-0.99902,0.034216,0.02808,-0.99902,0.039035,0.020865,-0.99902,0.039035,0.020865,-0.99902,0.039035,0.020865,-0.99902,0.042356,0.012849,-0.99902,0.042356,0.012849,-0.99902,0.042356,0.012849,-0.99902,0.044048,0.004339,-0.99902,0.044048,0.004339,-0.99902,0.044048,0.004339,-0.99902,0.044048,-0.004338,-0.99902,0.044048,-0.004338,-0.99902,0.044048,-0.004338,-0.99902,0.042356,-0.012848,-0.99902,0.042356,-0.012848,-0.99902,0.042356,-0.012848,-0.99902,0.039035,-0.020864,-0.99902,0.039035,-0.020864,-0.99902,0.039035,-0.020864,-0.99902,0.034214,-0.028079,-0.99902,0.034214,-0.028079,-0.99902,0.034214,-0.028079,-0.99902,0.02808,-0.034214,-0.99902,0.02808,-0.034214,-0.99902,0.02808,-0.034214,-0.99902,0.020865,-0.039035,-0.99902,0.020865,-0.039035,-0.99902,0.020865,-0.039035,-0.99902,0.012848,-0.042355,-0.99902,0.012848,-0.042355,-0.99902,0.012848,-0.042355,-0.99902,0.004339,-0.044048,-0.99902,0.004339,-0.044048,-0.99902,0.004339,-0.044048,-0.99902,-0.004338,-0.044048,-0.99902,-0.004338,-0.044048,-0.99902,-0.004338,-0.044048,-0.99902,-0.012848,-0.042355,-0.99902,-0.012848,-0.042355,-0.99902,-0.012848,-0.042355,-0.99902,-0.020865,-0.039035,-0.99902,-0.020865,-0.039035,-0.99902,-0.020865,-0.039035,-0.99902,-0.02808,-0.034214,-0.99902,-0.02808,-0.034214,-0.99902,-0.02808,-0.034214,-0.99902,-0.034213,-0.028079,-0.99902,-0.034213,-0.028079,-0.99902,-0.034213,-0.028079,-0.99902,-0.039035,-0.020864,-0.99902,-0.039035,-0.020864,-0.99902,-0.039035,-0.020864,-0.99902,-0.042357,-0.012848,-0.99902,-0.042357,-0.012848,-0.99902,-0.042357,-0.012848,-0.99902,-0.044048,-0.004338,-0.99902,-0.044048,-0.004338,-0.99902,-0.044048,-0.004338,-0.99902,-0.044048,0.004339,-0.99902,-0.044048,0.004339,-0.99902,-0.044048,0.004339,-0.99902,-0.042356,0.012849,-0.99902,-0.042356,0.012849,-0.99902,-0.042356,0.012849,-0.99902,-0.039035,0.020866,-0.99902,-0.039035,0.020866,-0.99902,-0.039035,0.020866,-0.99902,-0.034214,0.02808,-0.99902,-0.034214,0.02808,-0.99902,-0.034214,0.02808,-0.99902,-0.028077,0.034215,-0.99902,-0.028077,0.034215,-0.99902,-0.028077,0.034215,-0.99902,-0.020865,0.039036,-0.99902,-0.020865,0.039036,-0.99902,-0.020865,0.039036,-0.99902,-0.004338,0.044049,-0.99902,-0.004338,0.044049,-0.99902,-0.004338,0.044049,-0.99902,-0.012848,0.042357,-0.99902,-0.012848,0.042357,-0.99902,-0.012848,0.042357,-0.99902,-0.097885,-0.993836,-0.052037,-0.097885,-0.993836,-0.052037,-0.097885,-0.993836,-0.052037,-0.289891,-0.955644,-0.052037,-0.289891,-0.955644,-0.052037,-0.289891,-0.955644,-0.052037,-0.470758,-0.880727,-0.052037,-0.470758,-0.880727,-0.052037,-0.470758,-0.880727,-0.052037,-0.633534,-0.771963,-0.052037,-0.633534,-0.771963,-0.052037,-0.633534,-0.771963,-0.052037,-0.771963,-0.633534,-0.052037,-0.771963,-0.633534,-0.052037,-0.771963,-0.633534,-0.052037,-0.880727,-0.470757,-0.052037,-0.880727,-0.470757,-0.052037,-0.880727,-0.470757,-0.052037,-0.955644,-0.289892,-0.052037,-0.955644,-0.289892,-0.052037,-0.955644,-0.289892,-0.052037,-0.993836,-0.097885,-0.052037,-0.993836,-0.097885,-0.052037,-0.993836,-0.097885,-0.052037,-0.993837,0.097883,-0.052037,-0.993837,0.097883,-0.052037,-0.993837,0.097883,-0.052037,-0.955644,0.28989,-0.052038,-0.955644,0.28989,-0.052038,-0.955644,0.28989,-0.052038,-0.880727,0.470758,-0.052038,-0.880727,0.470758,-0.052038,-0.880727,0.470758,-0.052038,-0.771963,0.633534,-0.052037,-0.771963,0.633534,-0.052037,-0.771963,0.633534,-0.052037,-0.633535,0.771962,-0.052038,-0.633535,0.771962,-0.052038,-0.633535,0.771962,-0.052038,-0.470758,0.880726,-0.052038,-0.470758,0.880726,-0.052038,-0.470758,0.880726,-0.052038,-0.28989,0.955644,-0.052036,-0.28989,0.955644,-0.052036,-0.28989,0.955644,-0.052036,-0.097883,0.993836,-0.052036,-0.097883,0.993836,-0.052036,-0.097883,0.993836,-0.052036,0.097883,0.993836,-0.052036,0.097883,0.993836,-0.052036,0.097883,0.993836,-0.052036,0.289892,0.955644,-0.052036,0.289892,0.955644,-0.052036,0.289892,0.955644,-0.052036,0.470759,0.880726,-0.052037,0.470759,0.880726,-0.052037,0.470759,0.880726,-0.052037,0.633535,0.771962,-0.052037,0.633535,0.771962,-0.052037,0.633535,0.771962,-0.052037,0.771963,0.633533,-0.052037,0.771963,0.633533,-0.052037,0.771963,0.633533,-0.052037,0.880727,0.470757,-0.052037,0.880727,0.470757,-0.052037,0.880727,0.470757,-0.052037,0.955644,0.28989,-0.052037,0.955644,0.28989,-0.052037,0.955644,0.28989,-0.052037,0.993836,0.097884,-0.052037,0.993836,0.097884,-0.052037,0.993836,0.097884,-0.052037,0.993836,-0.097885,-0.052037,0.993836,-0.097885,-0.052037,0.993836,-0.097885,-0.052037,0.955643,-0.289893,-0.052037,0.955643,-0.289893,-0.052037,0.955643,-0.289893,-0.052037,0.880726,-0.470759,-0.052037,0.880726,-0.470759,-0.052037,0.880726,-0.470759,-0.052037,0.771962,-0.633535,-0.052037,0.771962,-0.633535,-0.052037,0.771962,-0.633535,-0.052037,0.633533,-0.771964,-0.052037,0.633533,-0.771964,-0.052037,0.633533,-0.771964,-0.052037,0.470757,-0.880727,-0.052037,0.470757,-0.880727,-0.052037,0.470757,-0.880727,-0.052037,0.097884,-0.993837,-0.052037,0.097884,-0.993837,-0.052037,0.097884,-0.993837,-0.052037,0.28989,-0.955644,-0.052037,0.28989,-0.955644,-0.052037,0.28989,-0.955644,-0.052037,0,0,1,0,0,1,0,0,1,-0,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0.000002,0.000003,1,-0.000002,0.000003,1,-0.000002,0.000003,1,-0,-0.000001,1,0.000005,-0.000001,1,0.000005,-0.000001,1,0.000005,-0.000001,1,0.000001,-0,1,0.000001,-0,1,0.000001,-0,1,0,0,1,-0.000002,-0.000002,1,-0.000002,-0.000002,1,-0.000002,-0.000002,1,-0,-0.000002,1,-0,-0.000002,1,-0,-0.000002,1,0.000001,0.000002,1,0.000001,0.000002,1,0.000001,0.000002,1,-0.000002,-0.000002,1,-0.000002,-0.000002,1,-0.000002,-0.000002,1,0.000007,-0.000001,1,0.000007,-0.000001,1,0.000007,-0.000001,1,-0.000002,-0.000001,1,-0.000002,-0.000001,1,-0.000002,-0.000001,1,-0.000003,-0.000001,1,-0.000003,-0.000001,1,-0.000003,-0.000001,1,0.000005,-0.000001,1,0.000005,-0.000001,1,0.000005,-0.000001,1,0.000001,0.000003,1,0.000001,0.000003,1,0.000001,0.000003,1,0,0,1,0,0,1,0,0,1,0.000007,0,1,0.000007,0,1,0.000007,0,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,0.000004,-0.000001,1,0.000004,-0.000001,1,0.000004,-0.000001,1,-0,-0.000001,1,-0,-0.000001,1,-0.000002,0.000001,1,-0.000002,0.000001,1,-0.000002,0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,-0.000001,-0.000001,1,0,0,1,-0,-0.000001,1,-0,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,0.000001,-0.000001,1,-0,0.000001,-1,0,0.000005,-1,0,0.000005,-1,0,0.000005,-1,0,0.000003,-1,0,0.000003,-1,0,0.000003,-1,-0,0.000001,-1,-0,0.000001,-1,-0,0.000001,-1,-0,0.000001,-1,-0,0.000001,-1,-0,0.000001,-1,0,0,-1,0,0,-1,0,0,-1,0.000001,0.000003,-1,0.000001,0.000003,-1,0.000001,0.000003,-1,0,0,-1,0,0,-1,-0.000003,0,-1,-0.000003,0,-1,-0.000003,0,-1,-0.000002,0.000002,-1,-0.000002,0.000002,-1,-0.000002,0.000002,-1,-0.000005,-0.000001,-1,-0.000005,-0.000001,-1,-0.000005,-0.000001,-1,0.012848,0.042356,-0.99902,0.012848,0.042356,-0.99902,0.012848,0.042356,-0.99902,-0.000007,0,-1,-0.000007,0,-1,-0.000007,0,-1,0.000005,0,-1,0.000005,0,-1,0.000005,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0.000006,0.000001,-1,0.000006,0.000001,-1,0.000006,0.000001,-1,0,0,-1,0,0,-1,0.000001,0,-1,0.000001,0,-1,0.000001,0,-1,-0,0.000001,-1,-0,0.000001,-1,0.000002,0.000003,-1,0.000002,0.000003,-1,0.000002,0.000003,-1,0.000011,-0.000001,-1,0.000011,-0.000001,-1,0.000011,-0.000001,-1,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,0.00434,0.044049,-0.99902,0.00434,0.044049,-0.99902,0.00434,0.044049,-0.99902,0.000004,0.000001,-1,0.000004,0.000001,-1,0.000004,0.000001,-1,-0,0.000001,-1,0.000002,0,-1,0.000002,0,-1,0.000002,0,-1,0,-0.000001,-1,0,-0.000001,-1,0,-0.000001,-1,0.020864,0.039036,-0.99902,0.020864,0.039036,-0.99902,0.020864,0.039036,-0.99902,0.028079,0.034216,-0.99902,0.028079,0.034216,-0.99902,0.028079,0.034216,-0.99902,0.034215,0.028079,-0.99902,0.034215,0.028079,-0.99902,0.034215,0.028079,-0.99902,0.039035,0.020866,-0.99902,0.039035,0.020866,-0.99902,0.039035,0.020866,-0.99902,0.042356,0.012848,-0.99902,0.042356,0.012848,-0.99902,0.042356,0.012848,-0.99902,0.044048,0.004339,-0.99902,0.044048,-0.004337,-0.99902,0.044048,-0.004337,-0.99902,0.044048,-0.004337,-0.99902,0.042356,-0.012848,-0.99902,0.039036,-0.020864,-0.99902,0.039036,-0.020864,-0.99902,0.039036,-0.020864,-0.99902,0.034213,-0.028079,-0.99902,0.034213,-0.028079,-0.99902,0.034213,-0.028079,-0.99902,0.02808,-0.034214,-0.99902,0.020865,-0.039035,-0.99902,0.01285,-0.042355,-0.99902,0.01285,-0.042355,-0.99902,0.01285,-0.042355,-0.99902,0.004338,-0.044048,-0.99902,0.004338,-0.044048,-0.99902,0.004338,-0.044048,-0.99902,-0.004338,-0.044048,-0.99902,-0.01285,-0.042355,-0.99902,-0.01285,-0.042355,-0.99902,-0.01285,-0.042355,-0.99902,-0.020865,-0.039035,-0.99902,-0.02808,-0.034214,-0.99902,-0.034215,-0.028079,-0.99902,-0.034215,-0.028079,-0.99902,-0.034215,-0.028079,-0.99902,-0.039036,-0.020864,-0.99902,-0.039036,-0.020864,-0.99902,-0.039036,-0.020864,-0.99902,-0.042356,-0.012848,-0.99902,-0.042356,-0.012848,-0.99902,-0.042356,-0.012848,-0.99902,-0.044048,-0.004337,-0.99902,-0.044048,-0.004337,-0.99902,-0.044048,-0.004337,-0.99902,-0.044048,0.004339,-0.99902,-0.042356,0.012849,-0.99902,-0.039035,0.020866,-0.99902,-0.034216,0.02808,-0.99902,-0.034216,0.02808,-0.99902,-0.034216,0.02808,-0.99902,-0.028079,0.034216,-0.99902,-0.028079,0.034216,-0.99902,-0.028079,0.034216,-0.99902,-0.020866,0.039036,-0.99902,-0.020866,0.039036,-0.99902,-0.020866,0.039036,-0.99902,-0.004338,0.044049,-0.99902,-0.012848,0.042356,-0.99902,-0.012848,0.042356,-0.99902,-0.012848,0.042356,-0.99902,-0.097884,-0.993837,-0.052037,-0.097884,-0.993837,-0.052037,-0.097884,-0.993837,-0.052037,-0.289891,-0.955644,-0.052037,-0.470758,-0.880726,-0.052037,-0.470758,-0.880726,-0.052037,-0.470758,-0.880726,-0.052037,-0.633533,-0.771963,-0.052037,-0.633533,-0.771963,-0.052037,-0.633533,-0.771963,-0.052037,-0.771964,-0.633533,-0.052037,-0.771964,-0.633533,-0.052037,-0.771964,-0.633533,-0.052037,-0.880726,-0.470758,-0.052037,-0.880726,-0.470758,-0.052037,-0.880726,-0.470758,-0.052037,-0.955644,-0.289892,-0.052038,-0.955644,-0.289892,-0.052038,-0.955644,-0.289892,-0.052038,-0.993836,-0.097884,-0.052037,-0.993836,-0.097884,-0.052037,-0.993836,-0.097884,-0.052037,-0.993837,0.097884,-0.052037,-0.993837,0.097884,-0.052037,-0.993837,0.097884,-0.052037,-0.955643,0.289893,-0.052037,-0.955643,0.289893,-0.052037,-0.955643,0.289893,-0.052037,-0.880726,0.470758,-0.052037,-0.880726,0.470758,-0.052037,-0.880726,0.470758,-0.052037,-0.771965,0.633532,-0.052037,-0.771965,0.633532,-0.052037,-0.771965,0.633532,-0.052037,-0.633533,0.771964,-0.052037,-0.633533,0.771964,-0.052037,-0.633533,0.771964,-0.052037,-0.470757,0.880727,-0.052037,-0.470757,0.880727,-0.052037,-0.470757,0.880727,-0.052037,-0.289892,0.955644,-0.052038,-0.289892,0.955644,-0.052038,-0.289892,0.955644,-0.052038,-0.097884,0.993836,-0.052037,-0.097884,0.993836,-0.052037,-0.097884,0.993836,-0.052037,0.097885,0.993836,-0.052037,0.097885,0.993836,-0.052037,0.097885,0.993836,-0.052037,0.289891,0.955644,-0.052038,0.289891,0.955644,-0.052038,0.289891,0.955644,-0.052038,0.470759,0.880726,-0.052037,0.633534,0.771963,-0.052037,0.633534,0.771963,-0.052037,0.633534,0.771963,-0.052037,0.771964,0.633533,-0.052037,0.771964,0.633533,-0.052037,0.771964,0.633533,-0.052037,0.880727,0.470758,-0.052037,0.880727,0.470758,-0.052037,0.880727,0.470758,-0.052037,0.955644,0.289891,-0.052037,0.955644,0.289891,-0.052037,0.955644,0.289891,-0.052037,0.993837,0.097884,-0.052037,0.993837,0.097884,-0.052037,0.993837,0.097884,-0.052037,0.993836,-0.097885,-0.052037,0.955644,-0.289893,-0.052037,0.955644,-0.289893,-0.052037,0.955644,-0.289893,-0.052037,0.880725,-0.47076,-0.052037,0.880725,-0.47076,-0.052037,0.880725,-0.47076,-0.052037,0.771963,-0.633534,-0.052037,0.771963,-0.633534,-0.052037,0.771963,-0.633534,-0.052037,0.633533,-0.771964,-0.052037,0.470757,-0.880727,-0.052037,0.097883,-0.993836,-0.052037,0.097883,-0.993836,-0.052037,0.097883,-0.993836,-0.052037,0.28989,-0.955644,-0.052037,0,1,0.000001,0,1,0.000001,0.19509,0.980785,0.000001,0.19509,0.980785,0.000001,0.382683,0.92388,0.000001,0.382683,0.92388,0.000001,0.382683,0.92388,0.000001,0.382683,0.92388,0.000001,0.55557,0.831469,0.000001,0.55557,0.83147,0.000001,0.55557,0.831469,0.000001,0.707107,0.707106,0,0.707106,0.707107,0,0.707107,0.707106,0,0.83147,0.55557,0,0.83147,0.55557,0,0.92388,0.382683,0,0.923879,0.382684,0,0.92388,0.382683,0,0.980785,0.195091,0,0.980785,0.19509,0,0.980785,0.195091,0,1,0.000001,-0,1,-0.000001,0,1,0.000001,-0,0.980785,-0.19509,-0,0.980785,-0.195091,-0,0.980785,-0.19509,-0,0.92388,-0.382683,-0,0.92388,-0.382683,-0,0.92388,-0.382683,-0,0.83147,-0.55557,-0,0.831469,-0.55557,-0,0.83147,-0.55557,-0,0.707107,-0.707106,-0,0.707106,-0.707107,-0,0.707107,-0.707106,-0,0.55557,-0.83147,-0,0.55557,-0.831469,-0.000001,0.55557,-0.831469,-0.000001,0.55557,-0.83147,-0,0.382683,-0.92388,-0.000001,0.382683,-0.92388,-0.000001,0.19509,-0.980785,-0.000001,0.19509,-0.980785,-0.000001,0.19509,-0.980785,-0.000001,0,-1,-0.000001,0,-1,-0.000001,0,-1,-0.000001,-0.195091,-0.980785,-0,-0.195091,-0.980785,-0.000001,-0.195091,-0.980785,-0.000001,-0.195091,-0.980785,-0,-0.382684,-0.923879,-0,-0.382684,-0.923879,-0,-0.555571,-0.831469,-0,-0.555571,-0.831469,-0,-0.555571,-0.831469,-0,-0.555571,-0.831469,-0,-0.707107,-0.707106,-0,-0.707107,-0.707106,-0,-0.83147,-0.55557,-0,-0.83147,-0.55557,-0,-0.83147,-0.55557,-0,-0.83147,-0.55557,-0,-0.92388,-0.382683,-0,-0.92388,-0.382683,-0,-0.980786,-0.195089,-0,-0.980785,-0.195089,-0,-0.980786,-0.195089,-0,-1,0.000001,0,-1,0.000001,0,-1,0.000001,0,-0.980785,0.195091,0,-0.980785,0.195091,0,-0.980785,0.195091,0,-0.980785,0.195091,0,-0.923879,0.382685,0,-0.923879,0.382684,0,-0.923879,0.382685,0,-0.831469,0.555571,0,-0.831469,0.555571,0,-0.707106,0.707108,0,-0.707106,0.707108,0,-0.707106,0.707108,0,-0.555569,0.83147,0.000001,-0.555569,0.83147,0.000001,-0.555569,0.83147,0.000001,-0.382682,0.92388,0.000001,-0.382682,0.92388,0.000001,-0.195089,0.980785,0.000001,0,1,0.000001,0,1,0.000001,-0.382682,0.92388,0.000001,-0.195089,0.980785,0.000001,-0.195089,0.980785,0.000001,0.19509,0.980785,0.000001,0.19509,0.980785,0.000001,0.55557,0.83147,0.000001,0.707106,0.707107,0,0.831469,0.555571,0,0.831469,0.555571,0,0.923879,0.382684,0,0.980785,0.19509,0,1,-0.000001,0,0.980785,-0.195091,-0,0.92388,-0.382683,-0,0.831469,-0.55557,-0,0.707106,-0.707107,-0,0.382683,-0.92388,-0.000001,0.382683,-0.92388,-0.000001,0.19509,-0.980785,-0.000001,0,-1,-0.000001,-0.382684,-0.923879,-0,-0.382684,-0.923879,-0,-0.707107,-0.707106,-0,-0.707107,-0.707106,-0,-0.92388,-0.382683,-0,-0.92388,-0.382683,-0,-0.980785,-0.195089,-0,-1,0.000001,0,-0.923879,0.382684,0,-0.831469,0.555571,0,-0.831469,0.555571,0,-0.707106,0.707108,0,-0.555569,0.83147,0.000001,-0.382682,0.92388,0.000001,-0.195089,0.980785,0.000001]}
