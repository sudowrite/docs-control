---
title: Saliency Engine
slug: 6295151-saliency-engine
category: '5566496'
collection_name: Story Smarts
featurebase_id: '6295151'
last_updated: '2026-02-15T19:27:10.222Z'
synced_at: '2026-03-31T23:18:08.340Z'
source: featurebase
---
## Saliency Engine

The first thing to know about Saliency Engine is that you won’t find a button or field for it anywhere in Sudowrite. **It’s running behind the scenes to help the AI stay focused on what’s relevant.**

You may have hundreds of Characters or Worldbuilding Elements in your Story Bible, but it’s rare that all of those will be relevant when you want to generate the prose for a specific beat. Saliency Engine reviews the task at hand, as well as all of the story information you’ve provided, in order to expose the most relevant information to the AI for prose generation purposes.

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6e2123b373be38049bd4/019be1a1-0f3c-7f76-8893-1db9644a8349/b64u-aW1hZ2UuZ2lm.gif?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=745daf70af52aa1393882f99ab40e9e25e3665a9c12736fd6708a595a2f42eb2)

Saliency Engine will **make sense of mountains of story context** in an instant, keeping anything you generate on track. That means, for example, if your shifter is in wolf form, the AI _won't_ reference the pleated khakis they might typically wear to work.

### Which features does Saliency Engine work with?

Right now **Saliency Engine works in three places**: your Story Bible, the Write button (when your Story Bible is enabled), and Plugins. In each case, Saliency Engine will do a first pass to identify information relevant to the writing task at hand before passing those details on to the AI in order to generate text.

### Do I have any control over Saliency Engine?

Sometimes, you want to keep the AI in the dark about your Characters or Worldbuilding elements. For that, we’ve introduced **visibility settings** at both the card and trait level.

If you’ve added a character that doesn’t appear until later in your story, and you’d like to make sure the AI ignores that character until then, you can hide them from Sudowrite. Just hover over the Character card and click on the eyeball icon that appears to toggle off the AI visibility.

**When the visibility of a Character, Worldbuilding element, or trait is toggled off, Sudowrite’s AI will ignore it altogether.**

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6e2123b373be38049bd4/019be1a1-a1fc-754d-a803-34a7c5f12215/b64u-aW1hZ2UucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=2773580cae7b091453139071585d3ac7a28372b222697f4a3d447a82d76b3c34)

Alternatively, lets say you want to include a Motive trait on the Character card for the murderer in your mystery. Saliency Engine _may_ consider a motive relevant to a scene, leading to an AI generation that spills the beans prematurely. To hide the Motive from Sudowrite, toggle the visibility setting within the Motive trait field from the eyeball icon in the upper right.

![](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6e2123b373be38049bd4/019be1a1-f8f0-76db-ba79-806c3b65a516/b64u-aW1hZ2UucG5n.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=025fabee405ed861d769253cfba406861904e2474449c8a578fcfeb7c3c5f568)

Click the eyeball icon from within the trait field to toggle that trait’s visibility. When the icon is set to a struck-through eye, the trait is hidden and Sudowrite will ignore it.

All Character and Worldbuilding cards and their traits are visible to the AI by default. That means, unless you say otherwise, Sudowrite’s Saliency Engine will decide whether or not those bits of story context are relevant to the task at hand.

You can toggle the visibility settings as often as necessary.

⚠️Remember that hiding a Character, Worldbuilding element, or trait from Sudowrite will hide it from all AI features. That means features like Chat, Write, and even Plugins will think it doesn’t exist (because they can’t see it).

### How Does Saliency Engine Work With Plugins?

Some plugins are designed to use your Story Bible data. In those cases, Saliency Engine may or may not be used, depending entirely on how the creator built that plugin.

-   If the creator chose to use the `{{ characters }}` or `{{ worldbuilding }}` variables, the Saliency Engine will kick in when necessary.
    
-   If the creator chose to use the `{{ characters_raw }}` or `{{ worldbuilding_raw }}` variables, the full context of those fields will be passed along into the AI in their entirety. The Saliency Engine will make no attempt to parse the data for relevant context.
    
    -   Note: In most cases, the `*_*raw` version will give the AI _way_ more context. This can either degrade or improve the results, depending on both the plugin configuration and the context passed through as a result… but it will almost always make the Plugin use more credits.
        
    -   **Hidden characters or traits will never be visible to the AI**, even if a Plugin is using the a `_raw` variable.
        

🚧 **Be Advised:** Credit cost is always calculated based on input, output, and the model selected. If a user with hundreds of Characters or Worldbuilding Elements uses a Plugin that includes the `_raw` version of a variable, a great deal of context will be passed through to the AI. **This could consume a ton of credits!**

All Plugins that predate the Saliency Engine use the standard `{{ characters }}` variable, and so will use Saliency Engine by default.
