import knex from "knex";


const db = knex({

  client: "mysql",
  acquireConnectionTimeout: 10000,
  
  connection: {
    port: 0,
    host: "",
    user: "",
    database: "", 
    password: "",  
  },
 

});

export default db;
