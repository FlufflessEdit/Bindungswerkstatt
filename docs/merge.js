const fs = require("fs");
let out = fs.readFileSync("index.html", "utf8")
  .replace('<link rel="stylesheet" href="style.css">',
    () => "<style>\n" + fs.readFileSync("style.css", "utf8") + "\n</style>");
for (const f of ["pse.js", "lewis.js", "modell.js", "physics.js", "render.js", "ui.js"]) {
  out = out.replace('<script src="' + f + '"></script>',
    () => "<script>\n" + fs.readFileSync(f, "utf8") + "\n</script>");
}
fs.writeFileSync("bindungswerkstatt.html", out);
console.log("OK → bindungswerkstatt.html");