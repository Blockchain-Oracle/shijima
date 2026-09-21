# OpenServ Platform Basics

**Channel:** OpenServ AI  
**Published:** 2025-11-11  
**Duration:** 29:27  
**URL:** https://www.youtube.com/watch?v=t4CoiKYMmvs  
**Source:** YouTube auto-generated captions (English, original audio track)

> Auto-generated captions. Product names and technical terms are sometimes mis-transcribed by the speech recogniser; read them in context.

---

## Chapters

- **0:00** — Intro
- **1:07** — Workflows section
- **2:06** — Create workflow
- **3:00** — Your workflows
- **3:10** — Templates
- **4:11** — Your templates
- **4:32** — Agents section
- **5:00** — Browse agents
- **5:56** — Build agents
- **7:00** — Add agent
- **8:32** — Your agents
- **10:17** — Connect section - Integrations
- **11:35** — MCPs
- **13:08** — Secrets
- **14:40** — Workspace walkthrough and basics

---

## 0:00 — Intro

**[0:02]** GM GM servers. Welcome to a basic tutorial on how opens works and a quick overview of the platform. So without further ado, let's get started. Once you've signed up on platform.openserve.ai, this is the homepage or the interface that you come across. Assuming that it's a new account, you won't see any workflows as such. But once you start making new workflows, it's going to show up out here. And there's some quick actions out here. You can go ahead and start a new workflow or explore the agents uh that are available uh as public agents or also private agents once you make them uh under your account. And then we've got an explore template section for exploring some standard templates.

**[0:59]** First let let's look into the left section out here with bunch of different categories. Starting with workflows.

## 1:07 — Workflows section

**[1:08]** Workflows are the most basic component of uh everything that you do on openserve. Work workflows or workspaces are essentially the main canvas on which you add uh all kinds of different agents and connect them together and make them carry out specific tasks. In simpler words, that's the main playground where you play around with all the different agents uh that you have added to the workspace and give them specific tasks and make them function in a specific manner based on the specific task you have in mind for each of these uh agents. We'll look into more of it as we go through some examples later on.

**[2:00]** Within workflows, we have got four separate sections. And uh the first one

## 2:06 — Create workflow

**[2:06]** would be the create workflow section where you can there are two ways in which you can start start a new workflow or a workspace. The first way would be by quickly entering a prompt of what exactly you want to build. uh it make sure that it's pretty descriptive and specific in terms of the functionalities that you intend to include for your use case. We have also got some example templates out here. For instance, V3 video generation where you can just enter like an a prompt or a description of the kind of video you want to generate and that gets passed over to the V3 agent and it generates the video for you.

**[2:49]** Further, another way of creating a workflow would be to just start blank. Start from the most basic setup. Uh we'll look into that uh later on. We've

## 3:00 — Your workflows

**[3:00]** also got the your workflows section out here where all the workflows that you have made will show up out here. And then we've got the template section

## 3:10 — Templates

**[3:12]** uh which has got two other categories within uh within it where there's a templates normal template section which shows all the public templates available to users created by different community members and also by openserve. uh you if you want to use a template you can just click on use template and create a workspace that completely clones the exact task descriptions and all the parameters that has been set by the template creator. So this would come in come quite handy eventually as there are bunch of cool templates that will be uh open sourced by open serve and also by community contributions that will also be token gated through X42 which can which can be which also means that template owners can also monetize their templates uh quite easily. Further, there's a my template section that just shows all the all the templates that you have created under your account. And

## 4:11 — Your templates

**[4:11]** then there's the your template section for a more uh in-depth overview of what your template does in terms of the agents that are part of the template. And then the goal and name and you can also submit it uh for review to make it live or to make it available to the public and further in the future monetize it. Moving forward, we've got

## 4:32 — Agents section

**[4:32]** the agent section. In terms of the way open serve works, we've got the workspace and then there are bunch of different agents that are part of the workspace and based on the specific use case you have in mind, you can choose the agents that you want to add to your workspace and assign each of these agents specific task and make them work work together in a way that makes sense for your use case. So here in under the

## 5:00 — Browse agents

**[5:01]** browse agent section we can see all these different agents that have been uh that are either hosted by open surf and publicly available for any user to add to their workspace. We have added bunch of different agents based on community requests whether it's research agent or v3 video generation agent and podcast creator etc. So there are a plethora of agents covering a wide variety of web 2 and also web 3 use cases. We've got polyarket data analysis and hyperlquid chart analysis and trading agents that you can easily drop into your workspace and play around with. And also agents that are made by the community members and approved by us also show up out here. And there's a my agent section for all the agents that you have created under your account. They can either be public or private.

## 5:56 — Build agents

**[5:57]** And then we have got an agent builder section over here where you can pick a model in terms of the the base model for the agent that you're building. This is a complete no code agent builder for picking a model and then giving it a name and giving it a system prompt that so that you can easily build a specialized purpose specific agent by picking the model of your choice and defining a system prompt and the capabilities it's capable of and drop it into your whole workflow setup wherever you think it makes sense to have a specialized agent that does a specific task. after either getting a specific input from another agent or just by itself and then forwarding the specific output based on your specific task description to the next agent. So this is a no code agent builder where you can define the system prompt and the capabilities and save it and add it to your workspace and play around with it. Further we have the add

## 7:00 — Add agent

**[7:01]** agent section which is a very important section for the for the developers of specialized agents. So this is focused on the coding community as such as in the de developers who who want to build specialized agents with the help of our TypeScript SDK or REST API where you can where they can give a specific name and and and also completely self-hosted on their end. So they have complete control over the specialized agent they have built and give it an endpoint and and briefly describe its capabilities so that the other agents part of the workspace are aware of the the capabilities of this agent that you have added to to the workspace and further on code you can pretty much you have pretty much created liberty to customize the agent with different tool calls and different external APIs and give it specific uh interesting capabilities based on whatever the kind of specialized agent that you're trying to build as a as an agent developer and once you have hosted it once you have built it and hosted it as a simple NodeJS HTTP server it will of course have a live URL that that'll get exposed uh based on wherever you're hosting for instance railway or even if you're hosting on AWS or uh Google cloud you'll have to expose it to the internet so that uh it has a specific public URL that can be interacted with and you drop it in here. And after that, once you save, you can go to the your agent

## 8:32 — Your agents

**[8:33]** section and click on details. And if it says external, that means that's a self-hosted agent created by uh you as the developer. And you can click on details. And initially it's going to ask you to create a secret key. So that once the secret key is created, you can drop into your agent code wherever you've deployed. So that when the platform when you when your specialized agent is added to the platform, the platform is aware that this it is this specific agent created by this agent developer and it has all these specific capabilities and the workspace can only interact with the agent through the public URL with the specific tools that you have exposed and uh and made it made public through the description of the capabilities. So you have complete control over over the agent that you create and you self-host it, but you use the secret key to just enable the workspace and other agents that are part of the workspace to be able to talk to your agent and do the tool calls based on your discretion.

**[9:34]** And further you can yeah you can also edit the endpoint URL. This is this in in case you're testing it locally, you can just use the encro URL or if it's live on prod, you can just drop in the prod URL out here and and like any other agent, you can always add the other external integrations like Twitter or Telegram so that the agent can can leverage Twitter or Telegram APIs to call specific functions based on the connections you have added. And there's also a knowledge file section for each of these agents where you can upload specific context files so that you can provide extra specialized context for each of your agents in terms of the specific use case you're targeting the agent for. Moving forward, we've got the

## 10:17 — Connect section - Integrations

**[10:20]** connect section under which we've got the integrations. The integrations are a list of integrations a mix of web 2 and web 3 uh integrations where uh we have got things like Google Google calendar, Google drive, Google mail, slack etc. And we've also got things like Twitter and Telegram which would be relevant in in the context of web 3. In terms of how you can add a new connection for Twitter, for example, you can click on add new connection and it's going to open the Twitter popup where you can authorize your Twitter account that is signed up on this browser. And once that's done, it gets added as a connection out here and and and it's accessible on any of the workspaces you create.

**[11:04]** Further, for the Telegram integration, you can just go ahead on Telegram like like you would create any other bot. You'll have to go to botfather on telegram and then create the new bot get take the bot token and drop it in here and save it. And once you've done that it it get it shows up out here as a telegram bot uh bot connection and further you can you can leverage the telegram bot API to interact with that bot.

## 11:35 — MCPs

**[11:36]** Moving forward, we've got the MCP server section where you can either pick up one of the already present uh MCP server examples or you can add your own MCP server. At the moment, we support SSE and HTTP classic. The HTTP streaming support will be added soon. So, you can give it give it give a name and description and drop in the MCP server URL. As long as it follows the MCP standards, you can just drop it in here. And then if there are any headers you can add them and click on connect and that should add it some over here as an MCP.

**[12:12]** You can build specialized MCPS for your specific use cases and connect it to the platform so that all the agents part of the workspace have access to this MCP server and can call the specific tools you have defined under the MCP spec. an example of how I I made an example MCP server and just dropped in the SSE uh URL exposing it locally and saved it out here. I will also be sharing this uh specific template so you can build on top of it and add whatever functions you want to using the basic template that follows these standards. Additionally, you can also add any SSE compatible MCP server. For instance, in this case, I had added the Cloudflare Cloud official Cloudflare docs MCP which supports SSE and you can just make use of all the tools that they uh expose through the MCP server on your work in your workspaces through the agents.

## 13:08 — Secrets

**[13:08]** Moving forward, we've got the secrets section. This is a very crucial section for mainly the web3 use cases where there are API keys or also possibly for rest API calling uh use cases where there are API keys associated with the uh API call you're trying to make. In such cases, you'll have to to securely manage your private key like let's say the agent wallet private key or the API key uh that you want to link. You can proceed to the secret section and add a new secret. give it a name and description and the secret value and drop it in here. We make sure that we follow the best practices to securely store the secrets and to ensure that it's securely accessed just by the agent. Uh but we would still suggest you to just make a new agent wallet and test around and play around until it's beta with small amount of funds and uh test and carry out and let the agent carry out specific trades for you and uh eventually of course we can move to uh full support and then uh you could further expand to larger amounts of funds. All right. Uh moving forward, let's look at we've got the credits and doc sections which are essentially uh what they sgest. They are credits of open source credits and then the doc section it just leads to the leads to our official documentation website. Now let's quickly look into uh

## 14:40 — Workspace walkthrough and basics

**[14:40]** how we can make a new workspace and uh just the key components of how the workspace uh looks. Uh all right. So let's quickly create a blank workflow. And there we go. Uh this is the main canvas that you would uh interact with. And this is where the main action uh happens with multiple agents working together to carry out the task that you have defined for each of them and then passing down data between each other and then sending it back to your application or uh pulling in external data calling APIs etc.

**[15:22]** So to begin with uh we can give the workspace a specific name and further we've got this important uh section out here starting with the design and run mode. Uh the design mode is pretty much what it uh what it means. The design mode is pretty much what it means essentially. It's the mode in which you design the workflow and define the task for different agents and basically set your whole uh agentic workflow uh workflow or workflows together and then uh define the characteristics etc. And further we've got the run mode. Once you've set up your agentic workflow you can move to the run mode. Of course, right now we don't have any workflow. Uh but yeah, once you move to the run mode, that's where you can you can start triggering the workflows and make the agents carry out the task that you've defined.

**[16:26]** Further, we've got the session section where in simple words, every new task trigger leads to the creation of a new session. Uh a very quick example would be if there are multiple users uh sending requests concurrently. Let's say there are two users sending requests. uh just just so that it's each of these requests are carried out are uh processed separately. Uh a new session is made for each of these requests and the specific task is executed for each of these requests. Further we've got the advanced settings where we have got group trigger events. This is just so that you can you you enable multiple events from the same session to just run in a single workflow and uh that that in simple words u means enabling the ability to be able to concurrently run multiple events with him within the uh same session uh in a workflow. And further we've got concurrency settings where you can define the maximum number of sessions that run concurrently and the rest of the requests get cued and then get executed uh according to the order they have they have arrived and further we have got maximum number of tasks per session sorry the maximum number uh [clears throat] of u the same concurrency per session and also per workspace uh so in terms of per session the default is one in terms of per workspace It's three and you can decide based on your specific workload or your specific use case. Uh you can decide a favorable or sensible number. Further we've got the timeout settings where you can define the max time out uh in seconds. The default would be 60 minutes. So this is for the whole workflow which would be a complex setup. 60 minutes is generally enough for most of the complex uh workflows. And further we have got each task specific uh timeout uh which in default by default it's 10 minutes which is again more than enough for a specific task within a larger workflow and then we've got max retry attempts which is three by default. Further we've got the integration and triggers section which is a crucial section here. Now as we already gone through the integration section with the web two and web 3 integrations.

**[18:57]** Now we've got few other uh so the same integrations show up out here and also if you have already added any connections to the integrations they also show up over here as connected integrations. In my case I've added the Twitter integration and the telegram bot integration. Hence they show up out here. You can also give specific names by renaming renaming them. And further we've got the triggers. The triggers are crucial a crucial aspect for the workspace. Uh they are the means through which you can execute or trigger a specific workflow that you have set up.

**[19:31]** We have got the manual trigger which is mainly used for testing so that you can just quickly pass an input and then trigger the workflow. Uh but in some cases where you just want want to where you just want to execute a specific workflow for a specific number of times and just get the output, you can just use the manual trigger uh once you switch to run mode of course. And then we've got the chron trigger. This is pretty useful for non uh no code use cases where you you want to run a specific let's say a scraping task or let's say a posting task or a research task every specific interval. uh you can just go ahead define something like every hour and like a time zone. You can be specific about that based on your use case and just define the define the crown trigger. And once you've done that, it it clearly tells you these are the intervals across which uh the next triggers are going to take place and it's going to stick to that specific schedule you have defined. Further, we've got the web hook trigger, which is a crucial trigger for developers or code specific use cases where you want to trigger it remotely through a back end or a front end of your application for very specific use cases. You can also send specific details or instructions in the body of the webbook trigger. It's a classic post request to the webbook URL.

**[21:02]** Further, we have got a special trigger over here which is the telegram trigger. Once you have added a telegram connection to under the connections and integrations, a special trigger shows up linked to the telegram bot integration that you that you have just added. And what does this do? Well, what a Telegram trigger does is essentially it leverages the Telegram bot API and keeps listening as long as it's enabled and in run mode. It keeps listening for any message sent to the Telegram bot on Telegram by any user. And for every single message trigger that has been triggered by by different users, it runs the workflow that that you connect this telegram trigger to and it it creates separate sessions for each of these users based on their ID or specific criteria and it executes the task. For instance, B just it could be as simple as just reply to the request sent by the user and it could just be an LM response based on the system prompt and then and the instructions you have defined.

**[22:13]** And this can further be extended to all kinds of use cases based on your specific uh Telegram bot purpose or use case. For instance, you want to serve video generation requests or you want to respond to specific commands uh or you want to just respond to specific natural language requests. You can all enable that by just connecting this telegram trigger to subsequent task subsequent task nodes and further defining the task description very clearly. And then in terms of the connected integrations, we've got Twitter and Telegram. Uh so these will be dropped into the task nodes based on if you want to leverage the integration by leveraging in terms of Twitter it would be the Twitter API and for diagram bot it would be the diagram bot API and we've got all their different integrations listed out here you can use them if you want to and here we've got the MCP connections that have been added to your book to your specific uh account and you can go ahead and again drop drag and drop it like any other integration onto a specific specific node if you want that specific task node or agent to be able to access the tools offered by the MCP.

**[23:27]** Further here we've got the input and output files. So sorry the output and uploaded files. The output file is basically any file that's been generated by an agent through a specific task. It could be a PDF file. It could be an image. It could be a video, etc. All of the files that are uploaded or generated within a workspace gets automatically indexed and every single agent that's part of the workspace has complete rack context of it. Hence, you don't have to deal with any of the vector engineering or context engineering or vector search setup. It gets automatically indexed. The same goes for uploaded files. You can just go ahead and upload an MD file or a text file with specific instructions or let's say a research paper. All the agents would have specific context of it and you can just and and just with natural language you can just be like go through that specific file and fetch me specific details and the agent would automatically go ahead and index through that and carry out the specific task.

**[24:36]** Perfect. And further some other key parts over here would be the undo and redo button which if you mess up it's just the undo and redo button that you can leverage and then we've got the auto layout for just getting back to the main setup and also the fit to screen so that you can just zoom out and fit everything. And then on the bottom right we've got another crucial section which is the agent section. Whenever you make a new blank o blank workflow initially the better project manager is the only agent that's part of the workflow. You can go ahead and talk to it and define or ask questions like I want to generate a VO3 video. Is there any agent for it?

**[25:23]** You can ask questions like this. uh be very descriptive and direct and the bear project manager is going to reply w with specific uh with specific context specific replies based on your question. And you can just go ahead and ask it to add an agent if you want to. And it would once you approve. There you go. The agent has been added. Further another way to add agents is just by clicking on the plus button out here and searching for the agent you want to add. For instance, poly market agent.

**[26:14]** And and there you go. it gets added to the workspace. You can also ask the better project manager to set up specific workflows based on your requirements. In this case, it just automatically figured out that I want to use the V3.1 agent and just set it up. Now, coming to the final uh components out here on the top right, we've got save as template. This is for being able to save a specific setup of the workspace with all the specific settings or all the specific task descriptions as it is and then sharing to other folks.

**[26:46]** Maybe make it a public template or just using it for yourself for future reference with a specific snapshot of the setup of the workflow. Further, we've got topup credits just for just topping up credits if credits if you run run out of it. and further a create MCP server option where you can make the workspaces workspace and MCP server and talk to it and also index through the files that that might have been generated and get context of how the workspace works and in the future we're also adding support for being able to monetizing using X42 and 804 and then we've got the key section or the key option out here to to add task.

**[27:34]** The add task has some key fields out here with description being the most important field and further we've got the input and output fields. The input field is just either going to take input from a previous node or a trigger or in a lot of cases it's going to be no input. So generally you can just type out none. And then we've got the output definition where you can define the specific format of definition uh out output. Then we've got the output definition section where you can define the specific format of output that you expect. It could either be in plain text or it could be in a structured format for by following a specific schema that you define. For instance, you can just define things like ID, maybe a response field and then give an give an input title and then further give it a title and also a very descriptive description so that the agents that are that are generating these outputs are aware of the kind of data that must be put into these fields.

**[28:41]** And then we have got the assigne section where you can assign the specific task to a specific agent. Just click on fill the rest from description and input can still be none. You can change it if you want to. And just go ahead and create a task. Once you do that, it's probably similar to what what the agent just made for you. It's more descriptive made by project manager but yes the way it works in principle is the same. So this was a quick walk through of the basics. We will soon jump into more examples and templates and even code walkthroughs. Thank you very much.

---

## Appendix: speech-recognition errors

The captions are machine-generated and consistently garble several product names.
Read these substitutions when working from the transcript above.

| Appears as | Almost certainly means |
| --- | --- |
| openserve, open serve, open surf, opens | OpenServ |
| X42, 804 | x402 (the HTTP 402 agent-payment protocol) |
| chron trigger, crown trigger | cron trigger |
| encro URL | ngrok URL (local tunnel for testing) |
| webbook | webhook |
| rack context | RAG context (retrieval-augmented generation) |
| V3, VO3, V3.1 | Veo 3 / Veo 3.1 (video generation model) |
| polyarket | Polymarket |
| hyperlquid | Hyperliquid |
| diagram bot | Telegram bot |
| LM response | LLM response |
| assigne | assignee |
| MCPS | MCPs (Model Context Protocol servers) |

Uncertain, flagged rather than guessed:

- **"bear project manager" / "better project manager"** — the default agent present
  on every new blank workflow. The real product name is not recoverable from audio
  alone. Confirm against the platform UI.
- **"GM GM servers"** — the opening greeting. Plausibly a community nickname
  ("Servs"), not the word "servers".
