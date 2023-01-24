require('dotenv').config();
const { Client } = require('@notionhq/client');
const { NOTION_TOKEN, NOTION_DATABASE_ID, KOBO_PATH, NOTION_MAX_PARAGRAPH_LENGTH } = process.env;
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

createPage = async ({ Title, Attribution }) => {
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

syncHighlights = async ({ id: pageId }, highlights) => {
    const chapters = group(highlights)
    for (const chapterId of Object.keys(chapters)) {
        await syncChapter(pageId, chapters[chapterId]);
    }
}

syncChapter = async (pageId, chapter) => {
    const { Title, Content } = chapter;
    const normalizedContent = splitOverflowingSentences(Content);
    const response = await notion.blocks.children.append({
        block_id: pageId,
        children: [{
            heading_3: {
                is_toggleable: true,
                rich_text: [
                    {
                        text: {
                            content: Title,
                        }
                    }
                ],
                children: normalizedContent.map(highlight => {
                    return {
                    paragraph: {
                        rich_text: [
                            {
                                text: {
                                    content: formatParagraph(highlight),
                                }
                            }
                        ]
                    }
                }
                }),
            }
        }]
    });
    return response;
}

formatParagraph = (p) => {
    return `${p.replace(/(\r\n|\n|\r)/gm, "").replace(/\s\s+/g, ' ')}\n`;
}

getHighlightsForBook = ({ ContentID }) => {
    const query = `
    select 
      Bookmark.Text,
      Bookmark.ContentId,
      chapter.title
    from 
      Bookmark 
      inner join content on Bookmark.volumeId = content.ContentId 
      inner join content as chapter on  instr(chapter.ContentId, Bookmark.ContentId) > 0
    where 
      content.ContentId = '${ContentID}' 
      and chapter.WordCount = -1
      order by
      chapter.VolumeIndex,
      Bookmark.ChapterProgress
    `;
    return kobo.prepare(query).all()
}

function GroupSentencesByLength(str, maxChars) {
    const workingStr = str.replace(/(\r\n|\n|\r)/gm, "").replace(/\s\s+/g, ' ').replace('`','\'');
    const sentences = workingStr.match( /[^\.!\?]+[\.!\?]+/g );
    const res = [];
    let currentFragment='';
    for(const sentence of sentences){
        if(joinSentences(sentence,currentFragment).length<maxChars){
            currentFragment=joinSentences(currentFragment, sentence);
        } else {
            res.push(currentFragment);
            currentFragment=sentence;
        }
    }
    if(currentFragment!=='') res.push(currentFragment);
    return res;
}

function joinSentences(sentence1, sentence2){
    return `${sentence1.trim()} ${sentence2.trim()}`;
}

splitOverflowingSentences = (highlights) => {
    const res = [];
    for(const highlight of highlights){
        if(highlight.length<=process.env.NOTION_MAX_PARAGRAPH_LENGTH) {
            res.push(highlight);
        } else {
            res.push(...GroupSentencesByLength(highlight, process.env.NOTION_MAX_PARAGRAPH_LENGTH))
        }
    }
    return res;
}

group = (highlights) => {
    const res = {};
    highlights.forEach(highlight => {
        const { ContentID, Title, Text } = highlight;
        if (!res[ContentID])
            res[ContentID] = { Title, Content: [Text] };
        else
            res[ContentID].Content.push(Text);
    });
    return res;
}

module.exports.getBooks = getBooks;
module.exports.createPage = createPage;
module.exports.getHighlightsForBook = getHighlightsForBook;

// select 
//   Bookmark.Text,
//   Bookmark.ContentId,
//   chapter.title
// from 
//   Bookmark 
//   inner join content on Bookmark.volumeId = content.ContentId 
//   inner join content as chapter on  instr(chapter.ContentId, Bookmark.ContentId) > 0
// where 
//   content.ContentId = '7610ec63-6435-466b-b475-129d1445236c' 
//   and chapter.WordCount = -1
//   order by
//   chapter.VolumeIndex,
//   Bookmark.ChapterProgress