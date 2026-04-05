import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("boot");
  }

  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#171411");

    this.add
      .text(width / 2, height / 2 - 24, "Twist_V1", {
        color: "#f0dcc2",
        fontFamily: "Georgia",
        fontSize: "42px"
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 28, "Agent-first colony sim scaffold", {
        color: "#bfa98b",
        fontFamily: "Segoe UI",
        fontSize: "18px"
      })
      .setOrigin(0.5);
  }
}
