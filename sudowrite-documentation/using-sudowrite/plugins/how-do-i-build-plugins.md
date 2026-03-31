---
title: How do I build Plugins?
slug: 1671769-how-do-i-build-plugins
category: '2165317'
collection_name: Plugins
featurebase_id: '1671769'
last_updated: '2026-02-15T19:27:10.222Z'
synced_at: '2026-03-31T23:18:08.324Z'
source: featurebase
---
## **Creating Plugins**

Roll up your sleeves and start making some Plugins of your own—for yourself or everyone on Sudowrite! If you know some basics when it comes to writing prompts for AI, building your first Plugin will be easy.

But before you get started, make sure to set your profile name to what you want publicly displayed. You can do so by clicking the Settings Gear icon in the upper right of Sudowrite and clicking Edit next to the name that appears in the top left of that popup. Whatever you set here is what will show up as the Creator Name on Plugins you Publish to the Directory.

To get started, click on the **Create Plugin** button in the **More Tools** dropdown, or else on the right of the Plugins Directory. Either way, you’ll be put into the plugin creation flow.

### The Magic Plugin Builder

We’ve simplified the plugin creation flow so that you can just describe what exactly you’d like a plugin to do.

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/019be1bc-c65b-76d3-aa84-99000686be31/b64u-aW1hZ2UucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=588eb7181aa981ff8d1fc69c6b1787ec63570cfa46a1088cc65beb19c73e3b63)

To use it, enter a plain text description of what sort of writing tool you’re looking for and click Generate Plugin. Remember that plugins can do any of three things: generate, analyze, or transform text. (The Magic Plugin Builder won’t create multi-stage plugins by default, but it’s worth noting that you can create a 2-stage plugin in case you’d like to do any of those things in sequence too!)

The Magic Plugin Builder will then create everything your plugin needs to work—a Title, a Description, a category, and Prompts (both System and User prompting). It will also have a default AI model assigned (GPT-4o), but it’s important to note that **you can change anything that was created for you**. This is just the fastest way to get to a rough draft of the writing tool you need.

### What Makes a Plugin?

Whether you use the Magic Plugin Builder or choose Skip, you’ll wind up in the Plugin Editor. This editor gives you granular control over how your Plugin works.

Here’s a look at some of the essential fields (some of which will be populated if you chose to let Sudowrite create your Plugin for you):

1.  **Name** - This is your Plugin’s name, and how it will be labeled in the directory should you choose to publish it. The name should be succinct, and clearly communicate what the Plugin does since this will also be how you identify the Plugin in the More Tools dropdown.
    
2.  **Description** - This is a description of what the Plugin does and how it works. It’s best to include specifics of how to use it—whether it needs a highlight, prompts a user in a text field, or otherwise. Depending on the Plugin, it may make sense to include an example input and output response.
    
3.  **Visibility** **Settings** - You can choose to Publish your Plugin to the Directory or keep it Unlisted. Unlisted plugins do not show up in the Directory or search results, but you can still use them—and anyone with the direct URL would also be able to see/install the Plugin.
    
    1.  **Instructions Visibility** - You can also choose to expose the instructions of your Plugin. This would make the System and User prompting visible on the Plugins description page.
        
4.  **Category** - Choose a single option from the options available to categorize your Plugin according to _what it is for_—anything from _Analysis & Feedback_ to _World-Building_. This will determine where the Plugin appears on the Explore page.
    
    _The Categories currently available are:_
    
    **Narrative & Plot** - Plugins that focus on creating and/or enhancing the plot.
    
    **Character Development** \- Plugins that assist in crafting and refining characters.
    
    **Editing & Revision** \- Plugins that improve the writing style and prose.
    
    **Scene Enhancement** - Plugins that help with improving or modifying a scene.
    
    **World-Building** - Plugins that aid in creating immersive and detailed fictional worlds. **Analysis & Feedback** - Plugins dedicated to providing in-depth evaluations and feedback on written content.
    
    **Marketing** \- Plugins designed to aid authors in promoting and distributing their work to a broader audience.
    
    **Genre-Specific** - Plugins that provide guidance and/or prompts tailored to specific genres, such as romance, horror, or young adult fiction.
    
    **Multi-Lingual** - Plugins that help with translation or are narrative tools that are language specific.
    
5.  **Input Options** - You have a couple of toggles that allow you to Adjust Inputs (in order to set minimum or maximum words the Plugin can be used on) or Allow Users to Give Instructions (which would let you configure a popup that appears when the plugin is used).
    
6.  **Prompts** - This is where you tell the AI exactly what to do. When a user uses your Plugin, the AI will read these instructions and any information the instructions point at (in the form of variables, described below). Be precise with your instructions, as if it were written for an assistant who cannot ask you follow-up questions while they are doing the task.
    

> **Good to Know**
> 
> Plugins use _the user’s_ **credits** when used, just like other Sudowrite features. Using the default AI model for Plugins means they’ll generally be pretty cost effective (but they could get expensive if you decide to use the complete contents of someone’s Story Bible as context).
> 
> Once you start changing the AI model and experimenting with your own variables, credit costs may vary. Be sure to test your Plugins for a sense of how much they’ll cost to use!

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/019be1c0-da21-7280-80c6-2d9fe92f8048/b64u-Q2xlYW5TaG90IDIwMjUtMDUtMjkgYXQgMTIuNDYuNDQoMykucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=502daaacf74a0912df115bc50ea8f38db05715cbf4cca7d5736b6aa8a305c9f8)

Here’s what each of the areas in the screenshot above controls:

1.  **Preceding Text** - Preceding Text is a variable representing the words before the cursor. In Basic Plugins this works as a fallback, reading the words before the cursor if the Plugin user had not highlighted anything. If you plan on using `{{ preceding_text }}` then you may want to specify the minimum and/or maximum number of words needed before the cursor for the Plugin to work here.
    
2.  **Highlighted Text** - Highlighted Text is a variable representing the words the user has highlighted—this will be replaced by the exact words the user has highlighted when the Plugin is run, passing that context into the prompt. If you plan on using `{{ highlighted_text }}` you can specify the minimum words required and maximum allowed for a highlight here.
    
3.  **Previous Document Text** - If the Plugin user has linked documents in their project in order to take advantage of Chapter Continuity, the `{{ previous_document_text }}` variable will allow the plugin access to that readback (up to the limits specified here).
    
4.  **User Text Input** - If you toggle on _Allow Users to Give Instructions_, you also enable the `{{ user_text_input }}` variable. With this feature enabled, your Plugin users will get a popup window before the Plugin is actually run, prompting them for input according to instructions you’ve defined. Inserting this variable in your Plugin instructions is a way to directly pass in end user input.
    

> **Available Variables** - In addition to the Input Options mentioned above (which have their own configurator inside of the Plugin builder) there are a bunch of additional variables available to enrich your custom Plugins.
> 
> `{{ previous_document_text }}` - The text from all previous documents in the chain of previous documents. This takes advantage of a user’s chapter continuity.
> 
> `{{ braindump }}` - The braindump from the story bible.
> 
> `{{ genre }}` - The genre from the user’s story bible.
> 
> `{{ style }}` - The style from the user’s story bible.
> 
> `{{ synopsis }}` - The synopsis from the user’s story bible.
> 
> `{{ characters }}` - The characters from the user’s story bible, optimized by the Saliency engine to only include textually relevant character data.
> 
> `{{ characters_raw }}` - All of the character data from the story bible, raw, unoptimized.
> 
> `{{ outline }}` - The outline from the story bible.
> 
> `{{ scene_summary }}` - The section of the outline linked with the current document a plugin is being used within, if any.
> 
> `{{ is_story_bible_active }}` - Information as to whether or not story bible is toggled on. `{{ chapter_scenes }}` - The Scenes from the story bible.
> 
> `{{ chapter_scenes_extra_instructions }}` - The Extra Instructions that a user has opted to include in their Draft box.
> 
> `{{ worldbuilding }}` - The worldbuilding entries from the story bible, optimized by the Saliency engine to only include what is textually relevant.
> 
> `{{ worldbuilding_raw }}` - The worldbuilding entries from the story bible, raw, unoptimized.

1.  **Prompts -** By default an Advanced Plugin has a simple Prompt area—**Prompt 1**. Inside of that box you can specify the exact instructions and LLM you’d like.
    
    1.  **System** - This specifies how the AI should behave. For instance, a system message could be: "You are a helpful assistant." This instructs the model to behave like a helpful assistant during the chat.
        
    2.  **User** - This is the substance of your plugin. Here, you will combine the user’s `{{ highlighted_text }}` and possibly the Story Bible data into a prompt for the language model to produce the desired functionality for the user. A few guidelines:
        
        -   Give a strong cue as to what part of the prompt is the user’s highlighted text, which will let the AI know what part is coming from the user. Something like:
            
        
        \`Here is a passage of text:
        
        {{ highlighted\_text }}
        
        Based on the passage of text provided, \[...rest of instructions...\]\`
        
        -   Be as specific as you can with your instructions. A good approach is to write this as if you’re writing an email to an assistant for them to do the task correctly on the first try without requiring clarifying questions.
            
        -   If prompt rewrites the user’s highlighted text, specify at the end how long the rewrite should be. If it should be rewriting into approximately the same number of words, say so, like `ONLY REWRITE THE PASSAGE, DO NOT MAKE IT LONGER`
            
        -   The genre, style, synopsis, characters, and outline are available as variables as well, allowing you to inject Story Bible data to influence the prompt.
            
    3.  **AI Options** - These options changes the behavior of the language model selected.
        
        1.  **Engine** - You can select from several different AI models. We believe `gpt-4o-mini` is sufficient for most tasks—but much more capable (albeit slower and more expensive) models exist, such as `gpt-4.1` and even `gemini-2.5-pro` which is capable of reading entire manuscripts.
            
        2.  **Temperature** - Think of this as the "creativity" dial. A higher temperature (e.g., 1.0) makes the model's responses more random and creative, while a lower temperature (e.g., 0.1) makes them more focused and deterministic. Ranges from `0` to `1.0`. We recommend `0.85` for most use cases.
            
        3.  **Frequency Penalty** - Controls how much the model avoids or prefers frequently used words or phrases. A negative value makes it more likely to use frequent words, while a positive value makes it avoid them. It's like asking a writer to avoid clichés: a positive value tells them to be more original and not use common phrases, while a negative value lets them use those familiar phrases freely.
            
        4.  **Presence Penalty** - This adjusts the model's inclination to include new ideas or topics. A positive value encourages it to introduce new concepts, while a negative value makes it stick more closely to the topics already mentioned. Imagine instructing a teacher: a positive value tells them to bring up new topics often, while a negative one tells them to stay on the current topic.
            
        5.  **Stop** - This parameter lets you specify words that, when generated by the model, will make it stop generating any further. For instance, if you set "stop" to be ".", the model would stop generating text as soon as it produces a period. It's like giving a speaker a cue: "When you mention this word or symbol, wrap up your speech.”
            
        6.  **Number of Generations** The number of cards your plugin should generate. Each card is an independent “run” of your plugin, and do not affect each other. Specifying more than one is useful if you want to give the user a diverse set of options to choose from. (Note: multi-stage prompts require this to be 1)
            
        7.  **Max Tokens** - This determines the maximum number of tokens the model will produce in its output (where a token is roughly 0.75 words). For example, if you set "max tokens" to 50, the model will not generate a response longer than 50 tokens.
            
2.  **Multi-Stage Prompts** - To create multi-stage prompts—which are essentially two of these in sequence—you can click on the “+ Prompt” button at the bottom, which will create a new prompt. The second stage is exactly the same as the first, except now you have access to a new variable `{{ prompt_1_result }}` which will be the output from the first prompt. This is great if you’d like to run an analysis, and the use that analysis to run an edit or text transformation in the following prompt.
    
    1.  Note that while you will see the prompt 1 result in testing, only the end result of the second prompt will be output to a card in the user’s History when a live Plugin is used. This means users will not see the intermediate prompt results. (In the example above, the end user would not see the analysis, only the transformed text.)
        

## **Testing Plugins**

At the bottom of the Plugin creation page, you will see a testing area:

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/019be1c2-dd67-720a-ba57-51f1317b3af8/b64u-aW1hZ2UucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=862b9ac26188365b3b5529fab5ca604757fbd492d73ba95a0ad303a79634f02d)

This lets you easily and quickly test your Plugin without publishing it. It’s essential that you test your plugin to make sure it works with a diverse set of inputs—and that you’re getting the results you want out of it. We suggest that you have a bank of inputs along with an idea what your expected output is. This way, as you iterate on the design of your plugin, you can make sure that the functionality matches your expectations.

Toggling Additional Variables exposes fields to populate Preceding Text as well as any Story Bible test data (in case your Plugin makes use of those). Note that we’ve pre-populated some Story Bible context for quick testing, but you can replace that with more tailored inputs for better results. (If you notice your Plugin is talking a lot about Bigfoot in testing, it’s possible you’re passing in this context without realizing it!)

## Creator Name

You can edit what name shows up for your Plugins by clicking on the small “Edit” link in the Settings (⚙️) menu in top right of your Sudowrite interface:

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6f0e94da8fb2bf6c0296/019be1c3-1db8-74dd-9099-141561098fc6/b64u-aW1hZ2UucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=8519604d87d3642d0afb4c9291c8bba8b0ab80ea6c0bbc651e197f11cd8c804b)

By default, if you’ve logged in via Google, that will be set to your Google display name.

Example Plugin

Now let’s run through an example - let’s make a Plugin that summarizes the user’s highlighted passage into specific plot points. We’ll use the Basic Editor like so:

**Name** - `Summarize Plot Points`

_This name makes it clear to the user what the plugin does. It also uses the active voice, which makes it more suited as an action in the dropdown._

**Description**

```
This plugin summarizes the highlighted text, focusing on story plot points. These plot points could be used as part of an outline, input to Story Engine beats, or for your own notes about a scene. Example Usage Input: Hours later, we had gotten used to the roar, and people had stopped stirring. I heard a soft thumping sound, which I took as another piece of debris glancing off the dome top. But then, a musty smell hit my nostrils. A swell of dust blew in from under the antechamber door, followed by another thump, a deep tone that rang from under the dome. “What was that?” Rosa said. “The passage,” Yan-Yan said. Inside the chamber, a musty smell hung in the air, and silt stung my eyes. It piled around our legs. Rosa shuddered. “What’s happening?” “Pressure differential.” I knew the dust meant the passage must have collapsed. We huddled and watched the trap door disgorge a concoction of sand and dirt. A faint voice called out, like it was coming from the end of a tin can phone. Yan-Yan slapped the ground. “Jack! Stay where you are, we’re coming!” Tina knelt down with her. “Who’s Jack?” “Her son,” I said. “He’s in the smaller dome, across the way.” I tapped a control panel on the wall, and it immediately blinked an angry red. Power totally out at Dome 2. I switched to the outside camera. Something had taken a chunk out of the dome. Yan-Yan’s eyes were wide. “Oh my god.” “I thought you said it’d withstand,” Ben said. A million niggling edge cases stabbed my mind. Perhaps I should have reinforced the pole trusses. Or maybe the ventilation system wasn’t properly sealed. Too late now. “I’ll get him,” I said. “I’m going with you,” Yan-Yan said, her fists clenched and shaking. I shook my head. “Not with your leg.” The wind dial was cracking 120. “Does Jack have his gear?” “Yes, but he’s still too light,” she said. She was right. I reckoned he was sixty pounds. Would blow away without being tethered. If the wind cracks 150, even I wouldn’t be able to walk outside. I needed someone to go with me. Output: 1. Characters are inside a dome when a disturbance, signaled by a musty smell and dust, occurs. 2. Rosa and Yan-Yan identify the disturbance as coming from a collapsed passage. 3. A faint voice from the second dome is recognized as Yan-Yan's son, Jack. 4. Surveillance reveals significant damage to the second dome, prompting concern and regret about the dome's design. 5. The protagonist decides to rescue Jack, with Yan-Yan eager to join despite her injury. 6. The outside environment's strong winds pose a serious threat to the rescue mission, especially considering Jack's light weight. 
```

Here, we describe clearly what the plugin does, and also give the user context on when it could be useful. We also give an example input and output, which will help the user understand how this plugin could fit into their workflow.

**Prompt**

```
Summarize this passage into story plot points that would be suitable as part of a story outline. Keep the number of plot points succinct. You should format the output into a numbered list. 
```

We make sure to give specific instructions so that the AI knows what kind of output is expected. A good way to approach writing these instructions is to think about what you’d have to write in an email to an assistant to make sure they get the job done without needing to ask clarifying questions.
