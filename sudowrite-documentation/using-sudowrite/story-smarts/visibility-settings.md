---
title: Visibility Settings
slug: 6550358-visibility-settings
category: '5566496'
collection_name: Story Smarts
featurebase_id: '6550358'
last_updated: '2026-02-15T19:27:10.222Z'
synced_at: '2026-03-31T23:18:08.341Z'
source: featurebase
---
### **What if I want to hide something from the AI?**

Sometimes, you want to keep the AI in the dark about your Characters or Worldbuilding elements. For that, we’ve introduced **visibility settings** at both the card and trait level.

If you’ve added a character that doesn’t appear until later in your story, and you’d like to make sure the AI ignores that character until then, you can hide them from Sudowrite. Just hover over the Character card and click on the eyeball icon that appears to toggle off the AI visibility.

**When the visibility of a Character, Worldbuilding element, or trait is toggled off, Sudowrite’s AI will ignore it altogether.**

![Notion image](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6e09266214e17734edfa/0198aec6-2b61-748d-a749-553e39dd4a91/b64u-MDE5OGFlYzYtMmI0My03NzU4LTg1OWYtNjAwOTgyMzdhNWVl.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=6b08622f2459184f6083e41692de74d93a45b4e404eb885b3eea8153f8daed35)

Alternatively, lets say you want to include a Motive trait on the Character card for the murderer in your mystery. Saliency Engine _may_ consider a motive relevant to a scene, leading to an AI generation that spills the beans prematurely. To hide the Motive from Sudowrite, toggle the visibility setting within the Motive trait field from the eyeball icon in the upper right.

![Click the eyeball icon from within the trait field to toggle that trait’s visibility. When the icon is set to a struck-through eye, the trait is hidden and Sudowrite will ignore it.](https://66f2e7f2298c40d9d4eb17c1.featurebase-attachments.com/c/article/689f6e09266214e17734edfa/0198aec6-2b89-79b2-a06d-5fa25ba63eaa/b64u-MDE5OGFlYzYtMmIzZC03MmVhLWEzMGYtYTYyOWEzNzNlNjli.png?X-Amz-Expires=3600&X-Amz-Date=20260331T230000Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO801TYC4FCVNNEKURKM%2F20260331%2Ffra1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=f9da0e209cdf905c5949563dd1b8b0e309773f0575af73c5212822239c7bf6e9)

Click the eyeball icon from within the trait field to toggle that trait’s visibility. When the icon is set to a struck-through eye, the trait is hidden and Sudowrite will ignore it.

All Character and Worldbuilding cards and their traits are visible to the AI by default. That means, unless you say otherwise, Sudowrite’s Saliency Engine will decide whether or not those bits of story context are relevant to the task at hand.

You can toggle the visibility settings as often as necessary.

> Remember that hiding a Character, Worldbuilding element, or trait from Sudowrite will hide it from all AI features. That means features like Chat, Write, and even Plugins will think it doesn’t exist (because they can’t see it).

### How does Saliency Engine work with Plugins?

Some plugins are designed to use your Story Bible data. In those cases, Saliency Engine may or may not be used, depending entirely on how the creator built that plugin.

-   If the creator chose to use the `{{ characters }}` or `{{ worldbuilding }}` variables, the Saliency Engine will kick in when necessary.
    
-   If the creator chose to use the `{{ characters_raw }}` or `{{ worldbuilding_raw }}` variables, the full context of those fields will be passed along into the AI in their entirety. The Saliency Engine will make no attempt to parse the data for relevant context.
    
    -   Note: In most cases, the `raw` version will give the AI _way_ more context. This can either degrade or improve the results, depending on both the plugin configuration and the context passed through as a result… but it will almost always make the Plugin use more credits.
        
    -   **Hidden characters or traits will never be visible to the AI**, even if a Plugin is using the a `raw` variable.
        

> **Be Advised:** Credit cost is always calculated based on input, output, and the model selected. If a user with hundreds of Characters or Worldbuilding Elements uses a Plugin that includes the `raw` version of a variable, a great deal of context will be passed through to the AI. **This could consume a ton of credits!**

All Plugins that predate the Saliency Engine use the standard `{{ characters }}` variable, and so will use Saliency Engine by default.
