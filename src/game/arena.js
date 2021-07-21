import MergedInput from "../main";
import Fighter from "./Fighter";

const Stances = {
  DASH: "DASH",
  BLOCK: "BLOCK",
  BALL: "BALL",
  IDLE: "IDLE",
};

export const pointlights = [];
export default class Arena extends Phaser.Scene {
  constructor() {
    super({ key: "Arena" });
  }
  init(data) {
    console.log("init", data);
    this.mapData = data.mapData;
    this.tileData = data.tileData;
    this.backgroundData = data.backgroundData;
    this.numberOfPlayers = data.numberOfPlayers;
  }
  preload() {
    this.load.scenePlugin("mergedInput", MergedInput);
    this.load.multiatlas("gamepad", "assets/gamepad.json", "assets");
    this.load.image(Stances.IDLE, "assets/Player.png");
    this.load.image(Stances.BLOCK, "assets/Block.png");
    this.load.image(Stances.DASH, "assets/Dash.png");
    this.load.image(Stances.BALL, "assets/Ball.png");
    this.load.image("spark", "assets/blue.png");

    //Setup for loading the base tilemap and required tile images
    this.load.tilemapTiledJSON("tilemap", `assets/${this.mapData}`);
    this.load.image("base_tiles", `assets/${this.tileData}`);
    this.load.image("background_tiles", `assets/${this.backgroundData}`);
  }

  create() {
    //Setup for loading the base tilemap and required tile images
    const map = this.make.tilemap({ key: "tilemap" });

    const backgroundTileset = map.addTilesetImage(
      "background",
      "background_tiles"
    );
    const backgroundLayer = map.createLayer(
      "backgroundLayer",
      backgroundTileset,
      0,
      0
    );
    const middleTileset = map.addTilesetImage("platforms_L1", "base_tiles");
    const middleLayer = map.createLayer("middleLayer", middleTileset, 0, 0);

    backgroundLayer.setScale(0.8);
    middleLayer.setScale(0.8);

    //smooth out fps
    // this.physics.world.syncToRender = true
    this.physics.world.fixedStep = false;
    this.physics.world.setBounds(0, 0, 1280, 720);
    middleLayer.setCollisionByProperty({ collides: true });
    middleLayer.setCollisionByExclusion([-1]);

    // Set up player objects
    this.players = Array.from(new Array(this.numberOfPlayers)).map((_, i) =>
      this.mergedInput.addPlayer(i)
    );

    let playerGroup = this.add.group();
    this.starts = [
      [280, 600],
      [1000, 150],
      [500, 300],
      [400, 100],
    ];

    // setup lighting + particles
    this.lights.enable();
    this.lights.active = true;
    this.trails = [];
    this.playerColors = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ];

    this.players.forEach((player, i) => {
      let [x, y] = this.starts[i];
      player.fighter = new Fighter(this, x, y);
      this.add.existing(player.fighter);
      this.physics.add.existing(player.fighter, false);
      this.physics.add.collider(middleLayer, player.fighter);
      player.fighter.score = 0;
      player.index = i;
      playerGroup.add(player.fighter);
      // create trail for players
      player.fighter.trail = this.add.particles("spark").createEmitter({
        speed: { min: 0, max: 0 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.5, end: 0, ease: "Expo.easeIn" },
        blendMode: "SCREEN",
        lifespan: 500,
        follow: player.fighter,
        active: false,
      });
      player.fighter.trail.reserve(1000);
      // create player backlight
      let [r, g, b] = this.playerColors[i];
      player.fighter.glow = this.add.pointlight(x, y, 0, 75, 0.2, 0.05);
      player.fighter.glow.color.r = r;
      player.fighter.glow.color.g = g;
      player.fighter.glow.color.b = b;
    });

    // Define keys (player, action, key, append)
    this.mergedInput
      .defineKey(0, "UP", "W")
      .defineKey(0, "DOWN", "S")
      .defineKey(0, "LEFT", "A")
      .defineKey(0, "RIGHT", "D")

      .defineKey(1, "UP", "UP")
      .defineKey(1, "DOWN", "DOWN")
      .defineKey(1, "LEFT", "LEFT")
      .defineKey(1, "RIGHT", "RIGHT")

      .defineKey(0, "B0", "ONE")
      .defineKey(0, "B1", "TWO")
      .defineKey(0, "B2", "THREE")
      .defineKey(0, "B3", "FOUR")
      .defineKey(0, "B4", "FIVE")
      .defineKey(0, "B5", "SIX")
      .defineKey(0, "B6", "SEVEN")
      .defineKey(0, "B7", "EIGHT")
      .defineKey(0, "B8", "NINE")
      .defineKey(0, "B9", "ZERO")

      .defineKey(1, "B0", "NUMPAD_ONE")
      .defineKey(1, "B1", "NUMPAD_TWO")
      .defineKey(1, "B2", "NUMPAD_THREE")
      .defineKey(1, "B3", "NUMPAD_FOUR")
      .defineKey(1, "B4", "NUMPAD_FIVE")
      .defineKey(1, "B5", "NUMPAD_SIX")
      .defineKey(1, "B6", "NUMPAD_SEVEN")
      .defineKey(1, "B7", "NUMPAD_EIGHT")
      .defineKey(1, "B8", "NUMPAD_NINE")
      .defineKey(1, "B9", "NUMPAD_ZERO");

    function rockPaperScissors(fighter, opponent) {
      const { BALL, BLOCK, DASH, IDLE } = Stances;
      switch (fighter.state) {
        case BALL:
          if (opponent.state == IDLE || opponent.state == BLOCK) {
            return handleWin(fighter, opponent);
          } else if (opponent.state == DASH) {
            return handleWin(opponent, fighter);
          }
        case BLOCK:
          if (opponent.state == IDLE || opponent.state == DASH) {
            return handleWin(fighter, opponent);
          } else if (opponent.state == BALL) {
            return handleWin(opponent, fighter);
          }
        case DASH:
          if (opponent.state == IDLE || opponent.state == BALL) {
            return handleWin(fighter, opponent);
          } else if (opponent.state == BLOCK) {
            return handleWin(opponent, fighter);
          }
        case IDLE:
          if (!["JUMPED", IDLE].includes(opponent.state)) {
            return handleWin(opponent, fighter);
          }
        default:
          return [null, null];
      }

      function handleWin(winner, loser) {
        // console.log(winner.score)
        loser.setPosition(loser.spawn.x, loser.spawn.y);
        loser.body.enable = false;
        loser.setActive(false).setVisible(false);
        winner.score += 1;
        setTimeout(() => {
          loser.setActive(true).setVisible(true);
          loser.body.enable = true;
          return;
        }, 1000);
        return [winner, loser];
      }
    }

    // add player colliders the hard way
    // (probably should be done using collision categories
    // or groups)
    for (let i = 0; i < this.players.length - 1; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        this.physics.add.collider(
          this.players[i].fighter,
          this.players[j].fighter,
          rockPaperScissors
        );
      }
    }

    // Set up some debug text

    this.debugTexts = [];
    this.scoreTexts = [];

    this.players.forEach((player, i) => {
      let r = this.playerColors[i][0];
      let g = this.playerColors[i][1];
      let b = this.playerColors[i][2];

      const scoreTextSpace = 300;
      this.scoreTexts[i] = this.add.text(
        100 + scoreTextSpace * i,
        50,
        player.fighter.score,
        {
          fontFamily: "Arial",
          fontSize: 44,
          color: `rgb(${r}, ${g}, ${b})`, //'#00ff00'
        }
      );

      // Used for distinguishing different controller texts
      // while debugging
      function randomColor() {
        let [r, g, b] = Array.from(new Array(3)).map(randomByte);
        return `rgb(${r}, ${g}, ${b})`;
        // *** helper ***
        function randomByte() {
          return Math.floor(Math.random() * 256);
        }
      }
    });
  }

  update() {
    // Loop through player inputs

    this.players.forEach((player, i) => {
      let { fighter } = player;
      fighter.update(player);
      this.scoreTexts[i].setText(player.fighter.score);
    });
  }
}
