import { Client, Message, MessageEmbed } from "discord.js";
import { Knex } from "knex";
import emojiList from "./emojis/map";

interface PlayerPriority {
  priority: number;
  id: string;
}
interface schemaModel {
  name: string;
  emoji: string;
  spots: number;
  spotsLeft: number;
  signed: PlayerPriority[];
  priority?: string[];
}

interface Format {
  schemaEmojiList: string[];
  schema: schemaModel[];
}
interface PartyMakerProps {
  discordToken: string;
  clientDescription?: string;
  clientConsoleOnReady?: string;

  client: Client;
  prefix: string;

  db: Knex<any[], unknown[]>
}

interface methods {

  Login(): void;
  insert(a: string[], i: number, n: string): string[];
  CheckingPattern(message: Message): Promise<boolean>;
  CheckingFormat(message: Message): Promise<Format>;
  RenderPartyMaker(
    message: Message,
    schema: schemaModel[],
    schemaEmojiList: string[]
  ): void;

  messageMonitor(): void;
  sentCatch(e: any): void;
}

class PartyMaker {
  private discordToken: string;
  private clientDescription?: string;
  private clientConsoleOnReady?: string;
  private client: Client;
  private prefix: string;
  private WARNING: number;
  private SUCCESS: number;
  private db: Knex<any[], unknown[]>

  constructor(props: PartyMakerProps) {
    this.client = props.client;
    this.discordToken = props.discordToken;
    this.db = props.db

    this.clientDescription = props?.clientDescription;
    this.clientConsoleOnReady = props?.clientConsoleOnReady;

    this.prefix = "partymaker";
    this.WARNING = 0xff0000;
    this.SUCCESS = 0x22bb33;
  }

  private sentCatch = (e: any) => console.log(e)
  private insert = (a: string[], i: number, n: string) => [...a.slice(0, i), n, ...a.slice(i)]

  private dynamicSort = (property: string) => {
    let sortOrder = 1;

    if (property[0] === "-") {
      sortOrder = -1;
      property = property.substr(1);
    }
    return function (a: any, b: any) {
      let result =
        a[property] < b[property] ? -1 : a[property] > b[property] ? 1 : 0;
      return result * sortOrder;
    };
  };

  private Login() {
    this.client.on("ready", () => {
      console.log(this.clientConsoleOnReady);

      this.client.user?.setActivity({
        name: this.clientDescription || "!partymaker [TAG]",
        type: "PLAYING",
      });
    });

    this.client.login(this.discordToken);
  }

  private CheckingFormat = async (message: Message): Promise<Format> => {

    const tag = message.content.split(" ")[1];
    let isWrongFormated = false;
    let dontRepeatEmoji: string[] = [];

    const requestSchema: any = await this.db("partymakerschema").where("tag", "=", tag);
    const parseSchema = JSON.parse(requestSchema[0].data);

    const schema: schemaModel[] = parseSchema.map((row: any) => {
      if (emojiList.hasOwnProperty(row.emojiCode)) {
        if (dontRepeatEmoji.includes(emojiList[row.emojiCode])) {
          isWrongFormated = true;
        }
        dontRepeatEmoji.push(emojiList[row.emojiCode]);
      } else {
        isWrongFormated = true;
      }

      return {
        name: row.name,
        emoji: emojiList[row.emojiCode],
        spots: row.spots,
        spotsLeft: row.spots,
        signed: [],
        priority: row?.priority || [],
      };
    });

    if (isWrongFormated) {
      message.channel
        .send(
          new MessageEmbed()
            .setColor(this.WARNING)
            .setTitle("Schema wrong formated")
            .setDescription("Please, fix this template by rules")
        )
        .catch(this.sentCatch);

      message.react("❌").catch(this.sentCatch);

      return {
        schemaEmojiList: [],
        schema: [],
      };
    }

    message.react("✅");

    const schemaEmojiList = schema.map((row) => row.emoji);

    const __prioridades = schema
      .map((role) => {
        const priorityList = role.priority
          ?.map((pessoa, index) => "<@" + pessoa + ">")
          .join(" ");
        return role.emoji + " " + priorityList;
      })
      .join("\n");

    await message.channel.send(
      new MessageEmbed()
        .setTitle("Lista de prioridades por role")
        .setDescription(__prioridades)
        .setFooter(
          "Caso queira concorrer às prioridades, desafie uma das pessoas da lista. _________ ________ ________ "
        )
    );

    return {
      schemaEmojiList,
      schema,
    };
  }

  private renderPartyMaker = async (
    message: Message,
    schema: schemaModel[],
    schemaEmojiList: string[]
  ) => {
    let isMessageLoading = true;

    message.channel
      .send("**⏲️⏲️⏲️⏲️⏲️⏲️ LOADING DATA ⏲️⏲️⏲️⏲️⏲️⏲️⏲**")
      .then(async (message) => {
        const MPartyMessageId = message.id;

        for (let i = 0; i < schemaEmojiList.length - 1; i++) {
          await message.react(schemaEmojiList[i]).catch(this.sentCatch);
        }

        await message
          .react(schemaEmojiList[schemaEmojiList.length - 1])
          .catch(this.sentCatch);

        await message
          .edit(
            new MessageEmbed()
              .setTitle("🌠🌠🌠🌠  Party automated maker  🌠🌠🌠🌠")
              .setColor(this.SUCCESS)
              .setDescription(
                schema
                  .map((role) => {
                    return `**${role.name} (${role.spots}) ${role.emoji}** `;
                  })
                  .join("\n\n")
              )
              .setTimestamp()
              .setFooter(
                "Aviso: a prioridade de fila foi implementada para pessoas que comparecem com frequência e são diferencial em cada role específica."
              )
          )
          .catch(this.sentCatch);

        await message
          .edit("React once to secure your spot!")
          .catch(this.sentCatch);

        isMessageLoading = false;

        let CountForPriority = 100;

        this.client.on("messageReactionAdd", async (reaction, user) => {
          if (user.bot) return false;

          if (reaction.message.id !== MPartyMessageId) {
            return;
          }

          if (isMessageLoading) {
            (await reaction.remove()).message.react(reaction.emoji.name);
            return;
          }

          const emoji = reaction.emoji.name;

          if (!schema.map((role) => role.emoji).includes(emoji)) {
            return false;
          }

          let alreadyRegistered = schema.map((role) => {
            let isRegistered = false;
            for (let i = 0; i < role.signed.length; i++) {
              isRegistered =
                role.signed[i].id === user.id ? true : isRegistered;
            }

            return isRegistered;
          });

          if (alreadyRegistered.includes(true)) {
            //(await reaction.remove()).message.react(emoji)
            return false;
          }

          let description = schema
            .map((role) => {
              if (emoji == role.emoji) {
                role.signed.push({
                  id: user.id,
                  priority: role?.priority?.includes(user.id)
                    ? role.priority.indexOf(user.id)
                    : ++CountForPriority,
                });

                role.signed.sort(this.dynamicSort("priority"));
                role.spotsLeft = role.spotsLeft - 1;
              }

              let signedMembers = role.signed
                .map((pessoa, index) =>
                  index < role.spots ? "<@" + pessoa.id + ">" : ""
                )
                .join(" ");

              let Queue = role.signed
                .map((pessoa, index) =>
                  index >= role.spots ? "<@" + pessoa.id + ">" : ""
                )
                .join(" ");

              if (Queue.length > 8) Queue = "**Em fila**: " + Queue;

              return (
                `**${role.name} (${role.spotsLeft < 0 ? 0 : role.spotsLeft}) ${
                  role.emoji
                }** ${signedMembers}\n` + Queue
              );
            })
            .join("\n");

          message
            .edit(
              new MessageEmbed()
                .setTitle("🌠🌠🌠🌠  Party automated maker  🌠🌠🌠🌠")
                .setColor(this.SUCCESS)
                .setDescription(description)
                .setTimestamp()
                .setFooter(
                  "Aviso: a prioridade de fila foi implementada para pessoas que comparecem com frequência e são diferencial em cada role específica."
                )
            )
            .catch(this.sentCatch);
        });

        this.client?.on("messageReactionRemove", async (reaction, user) => {
          if (user.bot) {
            return;
          }
          if (reaction.message.id !== MPartyMessageId) {
            return;
          }

          const emoji = reaction.emoji.name;

          if (!schema.map((role) => role.emoji).includes(emoji)) {
            return false;
          }

          const description = schema
            .map((role) => {
              if (role.emoji == emoji) {
                let old = role.signed.length;

                role.signed = role.signed.filter((item) => item.id !== user.id);
                let newl = role.signed.length;

                if (old !== newl) role.spotsLeft = role.spotsLeft + 1;
              }

              let signedMembers = role.signed
                .map((pessoa, index) => {
                  return index < role.spots ? "<@" + pessoa.id + ">" : "";
                })
                .join(" ");

              let Queue = role.signed
                .map((pessoa, index) => {
                  return index >= role.spots ? "<@" + pessoa.id + ">" : "";
                })
                .join(" ");

              if (Queue.length > 5) Queue = "**Em fila**: " + Queue;

              return (
                `**${role.name} (${role.spotsLeft < 0 ? 0 : role.spotsLeft}) ${
                  role.emoji
                }** ${signedMembers}\n` + Queue
              );
            })
            .join("\n");

          message
            .edit(
              new MessageEmbed()
                .setTitle("🌠🌠🌠🌠  Party automated maker  🌠🌠🌠🌠")
                .setColor(this.SUCCESS)
                .setDescription(description)
                .setTimestamp()
                .setFooter(
                  "Aviso: a prioridade de fila foi implementada para pessoas que comparecem com frequência e são diferencial em cada role específica."
                )
            )
            .catch(this.sentCatch);
        });
      })
      .catch(this.sentCatch);
  };
  private messageMonitor = () => {

    this.client.on("message", async (message: Message) => {
      if (!(await this.CheckingPattern(message))) {
        return false;
      }

      this.CheckingFormat(message).then((response) => {
        if (
          !response.schema.length ||
          !response.schema ||
          !response.schemaEmojiList.length ||
          !response.schemaEmojiList
        ) {
          return false;
        }

        this.renderPartyMaker(
          message,
          response.schema,
          response.schemaEmojiList
        );
      });
    });
  };
  private CheckingPattern = async (message: Message): Promise<boolean> => {
    if (message.author.bot) {
      return false;
    }

    if (
      !message.content.includes(this.prefix) ||
      !message.content.slice(1, message.content.length).startsWith(this.prefix)
    ) {
      return false;
    }

    message.react("⏰").catch(this.sentCatch);
    const tag = message.content.split(" ")[1];

    const tagsAvailabletoConvert: any = await this.db("partymakerschema").select("tag");

    const tagsAvailable = tagsAvailabletoConvert.map((tags) => tags.tag);

    if (!tag ||tag == "" ||tag == undefined ||tag == null ||!tagsAvailable.includes(tag)) {
      message.react("❌");

      message.channel
        .send(
          new MessageEmbed()
            .setTitle("Invalid format.")
            .setDescription(
              "**Please try &partymaker <tag>**.\n\nTags available: **" +
                tagsAvailable.join(", ") +
                "**"
            )
            .setColor(this.WARNING)
        )
        .catch(this.sentCatch);
      return false;
    }
    return true;
  };
  public async init() {
    try {
      this.Login();
      this.messageMonitor();
    } catch (e) {
      console.log(e)
    }
  }
}

export default PartyMaker;
