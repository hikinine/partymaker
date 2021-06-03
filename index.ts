import { Client } from "discord.js"
import PartyMaker from "./bot"
import connection from "./connection"

new PartyMaker({
  discordToken: "",
  db: connection,
  client: new Client(),
  prefix: "partymaker",
  clientDescription: "!partymaker [TAG]",
  clientConsoleOnReady: "Partymaker is online"
})