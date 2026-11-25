export async function chartPng(page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 208;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#19253b";
    ctx.fillRect(0, 0, 400, 208);
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#ebf2fe";
    ctx.fillText("Render time · ms", 24, 30);
    for (const y of [52, 87, 122, 157]) {
      ctx.fillStyle = "#384963";
      ctx.fillRect(24, y, 352, 1);
    }
    for (const [i, value] of [70, 52, 64, 90, 115, 88, 58].entries()) {
      const x = 33 + i * 50;
      ctx.fillStyle = i === 4 ? "#ffbd84" : "#8cc8ff";
      ctx.fillRect(x, 175 - value, 30, value);
      ctx.fillStyle = "#d8e3f6";
      ctx.font = "12px sans-serif";
      ctx.fillText(`${i + 1}`, x + 11, 194);
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(data, "base64");
}
