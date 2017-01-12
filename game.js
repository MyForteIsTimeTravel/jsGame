/** 
 *  Level Map and Parsing
 */


var actorChars = {
    "@": player,
    "o": coin,
    "=": lava,
    "|": lava,
    "v": lava
};

function Level (map) {
    this.width  = map[0].length
    this.height = map.length
    this.grid   = [];
    this.actors = [];
    
    for (var y = 0; y < this.height; y++) {
        var line = map[y];
        var gridLine = [];
        
        for (var x = 0; x < this.width; x++) {
            var ch = line[x];
            var fieldType = null;
            var actor = actorChars[ch];
            
            if (actor) {
                this.actors.push(new actor(new Vector(x, y), ch));
            }
            
            else if (ch == "x") {
                fieldType = "wall";
            }
            
            else if (ch == "!") {
                fieldType = "lava";
            }
            
            gridLine.push(fieldType);
        }
        
        this.grid.push(gridLine);
    }
    
    this.player = this.actors.filter(function (actor){
        return actor.type == "player";
    })[0];
    
    this.status = this.finishDelay = null;
}

Level.prototype.obstacleAt = function (pos, size) {
    var xStart = Math.floor(pos.x);
    var xEnd = Math.ceil(pos.x + size.x);
    var yStart = Math.floor(pos.y);
    var yEnd = Math.ceil(pos.y + size.y);
    
    if (xStart < 0 || xEnd > this.width || yStart < 0) {
        return "wall";
    }
    
    if (yEnd > this.height) {
        return "lava";
    }
    
    for (var y = yStart; y < yEnd; y++) {
        for (var x = xStart; x < xEnd; x++) {
            var fieldType = this.grid[y][x];
            if (fieldType) return fieldType;
        }
    }
};

Level.prototype.actorsAt = function (actor) {
    for (var i = 0; i < this.actors.length; i++) {
        var other = this.actors[i];
        
        if (other != actor &&        
            actor.pos.x + actor.size.x > other.pos.x &&
            actor.pos.x < other.pos.x + other.size.x &&
            actor.pos.y + actor.size.y > other.pos.y &&
            actor.pos.y < other.pos.y + other.size.y) {
            return other;
        }
    }
};

var maxTimeStep = 0.05;

Level.prototype.animate = function (timeStep, keys) {
    if (this.status != null)
        this.finishDelay -= timeStep;
    
    while (timeStep > 0) {
        var thisTimeStep = Math.min(timeStep, maxTimeStep);
        this.actors.forEach (function (actor) {
            actor.act(thisTimeStep, this, keys);
        }, this);
        timeStep -= thisTimeStep;
    }
};

Level.prototype.playerTouched = function (type, actor) {
    if (type == "lava" && this.status == null) {
        this.status = "lost";
        this.finishDelay = 1;
    }
    
    else if (type == "coin") {
        this.actors = this.actors.filter(function(other) {
            return other != actor;
        });
        
        if (!this.actors.some(function (){
            return actor.type == "coin";
        })) {
            this.status = "won";
            this.finishDelay = 1;
        }
    }
};

Level.prototype.isFinished = function () {
    return this.status != null && this.finishDelay < 0;
}

/** 
 *  Player
 */
var playerXSpeed = 7;
var gravity = 30;
var jumpSpeed = 17;

function player(pos) {
    this.pos   = pos.plus(new Vector(0, -0.5));
    this.size  = new Vector(0.8, 1.5);
    this.speed = new Vector(0, 0);
}

player.prototype.type = "player";

player.prototype.moveX = function (timeStep, level, keys) {
    this.speed.x = 0;
    if (keys.left) this.speed.x -= playerXSpeed;
    if (keys.right) this.speed.x += playerXSpeed;
    
    var motion = new Vector(this.speed.x * timeStep, 0);
    var newPos = this.pos.plus(motion);
    var obstacle = level.obstacleAt(newPos, this.size);
    
    if (obstacle) {
        level.playerTouched(obstacle);
    }
    
    else {
        this.pos = newPos;
    }
};

player.prototype.moveY = function (timeStep, level, keys) {
    this.speed.y += timeStep * gravity;
    var motion = new Vector(0, this.speed.y * timeStep);
    var newPos = this.pos.plus(motion);
    var obstacle = level.obstacleAt(newPos, this.size);
    
    if (obstacle) {
        level.playerTouched(obstacle);
        
        if (keys.up && this.speed.y > 0) {
            this.speed.y = -jumpSpeed;
        }
        
        else {
            this.speed.y = 0;
        }
    }
    
    else {
        this.pos = newPos;
    }
};

player.prototype.act = function (timeStep, level, keys) {
    this.moveX(timeStep, level, keys);
    this.moveY(timeStep, level, keys);
    
    var otherActors = level.actorsAt(this);
    if (otherActors)
        level.playerTouched(otherActor.type, otherActor);
    
    // end game
    if (level.status == "lost") {
        this.pos.y += timeStep;
        this.size.y -= timeStep
    }
};

/** 
 *  Lava
 */
function lava (pos, ch) {
    this.pos = pos;
    this.size = new Vector(1, 1);
    
    if (ch == "=") {
        this.speed = new Vector(2, 0);
    }
    
    else if (ch =="|") {
        this.speed = new Vector(0, 2);
    }
    
    else if (ch == "v") {
        this.speed = new Vector(0, 3);
        this.repeatPos = pos;
    }
}

lava.prototype.type = "lava";

lava.prototype.act = function (timeStep, level) {
    var newPos = this.pos.plus(this.speed.times(timeStep));
    
    if (!level.obstacleAt(newPos, this.size)) {
        this.pos = newPos;
    }
    
    else if (this.repeatPos) {
        this.pos = this.repeatPos;
    }
    
    else {
        this.speed = this.speed.times(-1);
    }
};

/** 
 *  Coin
 */
var wobbleSpeed = 8;
var wobbleDist  = 0.07;

function coin (pos) {
    this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1));
    this.size    = new Vector(0.6, 0.6);
    this.wobble = Math.random() * Math.PI * 2;
}

coin.prototype.act = function (timeStep) {
    this.wobble += timeStep * wobbleSpeed;
    var wobblePos = Math.sin(this.wobble) * wobbleDist;
    this.pos = this.basePos.plus(new Vector(0, wobblePos));
};

coin.prototype.type = "coin";


/** 
 *  Input
 */
var arrowCodes = {
    37: "left",
    38: "up",
    39: "right"
};

function trackKeys (codes) {
    var pressed = Object.create(null);
    function handler (event) {
        if (codes.hasOwnProperty(event.keyCode)) {
            var down = event.type == "keydown";
            
            pressed[codes[event.keyCode]] = down;
            event.preventDefault();
        }
    }
    
    addEventListener("keydown", handler);
    addEventListener("keyup", handler);
    return pressed;
}

/** 
 * loop
 */
function update (frameFunc) {
    var lastTime = null;
    function frame (time) {
        var stop = false;
        if (lastTime != null) {
            var timeStep = Math.min(time - lastTime, 100) / 1000;
            stop = frameFunc(timeStep) === false;
        }
        lastTime = time;
        if (!stop) {
            requestAnimationFrame(frame);
        }
    }
    requestAnimationFrame(frame);
}

var arrows = trackKeys(arrowCodes);

function runLevel (level, Display, andThen) {
    var display = new Display(document.body, level);
    update(function (timeStep) {
        level.animate(timeStep, arrows);
        display.drawFrame(timeStep);
        
        if (level.isFinished()) {
            display.clear();
            
            if (andThen) {
                andThen(level.status);
            }
            
            return false;
        }
    });
}

function runGame (plans, Display) {
    function startLevel (n) {
        runLevel(new Level(plans), Display, function(status) {
            if (status == "lost") 
                startLevel(n);
            else
                console.log("you win");
        });
    }
    
    startLevel(0);
}