require('dotenv').config();
const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
const { Client } = require("@notionhq/client");
const notion = new Client({ auth:NOTION_TOKEN })

const { getBooks, createPage, appendContentToPage, getHighlightsForBook } = require('./helpers.js');

const books = getBooks();
books.forEach(async book => {
    const { Title } = book;
    const res = await notion.databases.query({
        database_id: NOTION_DATABASE_ID,
        filter: {
            and: [
                {
                    property:"title",
                    rich_text: {
                        equals: Title,
                    }
                },
            ]
        }
     })

     const cases = {
        '0' : async () => {
            console.log(`Syncing ${Title}...`)
            const highlights = await getHighlightsForBook(book);
            const page = await createPage({...book});
            await syncHighlights(page, highlights)
        },
        '1' : () => {
            console.log(`${Title} already synced`)
        },
        default : () => {},
     }

     const takeAction = cases[res.results.length] || cases.default;
     takeAction();
})

