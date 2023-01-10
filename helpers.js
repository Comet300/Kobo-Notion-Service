require('dotenv').config();
const { Client } = require('@notionhq/client');
const { NOTION_TOKEN, NOTION_DATABASE_ID, KOBO_PATH } = process.env;
const notion = new Client({ auth: NOTION_TOKEN });
const kobo = require("better-sqlite3")(KOBO_PATH);

getBooks = () => {
    const query = `
        SELECT DISTINCT content.contentid,
                        content.title,
                        content.attribution
        FROM   bookmark
            INNER JOIN content
                    ON bookmark.volumeid = content.contentid
        ORDER  BY content.title 
        `;

    return kobo.prepare(query).all()
}

createPage = async ({Title, Attribution}) => {
    const res = await notion.pages.create({
        "icon": {
            "type": "emoji",
            "emoji": "📖"
        },
        "parent": {
            "type": "database_id",
            "database_id": NOTION_DATABASE_ID
        },
        "properties": {
            "Name": {
                "title": [
                    {
                        "text": {
                            "content": Title
                        }
                    }
                ]
            },
            "Author": {
                "rich_text": [
                    {
                        "text": {
                            "content": Attribution
                        }
                    }
                ]
            },
        },
    });
    console.log(`Created the page for ${Title}`)
    return res;
}

syncHighlights = async ({id}, highlights) =>{
    const processedHighlights = normalize(highlights)
    while(processedHighlights.length>0){
        const pendingHighlights = processedHighlights.splice(0,99);
        await appendContentToPage(id, pendingHighlights);
    }
}

appendContentToPage = async (id, highlights) =>{
    const processedHighlights = normalize(highlights)
    const response = await notion.blocks.children.append({
        block_id: id,
        children: processedHighlights.map(highlight => {
            return {
            "paragraph": {
                "rich_text": [
                  {
                    "text": {
                      "content": highlight,
                    }
                  }
                ]
              }
            }
        })
    });
    return response;
}

getHighlightsForBook = ({ContentID}) => {
    const query = `
select 
  Bookmark.Text 
from 
  Bookmark 
  inner join content on bookmark.volumeId = content.ContentId 
where 
  content.ContentId = '${ContentID}' 
order by 
  content.DateAdded desc
    `;
    return kobo.prepare(query).all()
}

splitString = (str, N) => {
    const arr = [];
  
    for (let i = 0; i < str.length; i += N) {
      arr.push(str.substring(i, i + N));
    }
  
    return arr;
  }

  normalize = (highlights) =>{
    const res = highlights.map(highlight => {
        if(highlight.length > 2000)
            return splitString(highlight,1999);
        return highlight
    })
    return res.flat();
}

module.exports.getBooks=getBooks;
module.exports.createPage=createPage;
module.exports.appendContentToPage=appendContentToPage;
module.exports.getHighlightsForBook=getHighlightsForBook;