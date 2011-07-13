LABjs (Loading And Blocking JavaScript)

LABjs is a dynamic script loader intended to replace the use of the ugly, non-performant <script> tag with a flexible and performance-optimized alternative API.

The defining characteristic of LABjs is the ability to load *all* JavaScript files in parallel, as fast as the browser will allow, but giving you the option to ensure proper execution order if you have dependencies between files.

For instance, the following "<script> tag soup":

<script type="text/javascript" src="http://remote.tld/jquery.js"></script>
<script type="text/javascript" src="local/plugin1.jquery.js"></script>
<script type="text/javascript" src="local/plugin2.jquery.js"></script>
<script type="text/javascript" src="local/init.js"></script>
<script type="text/javascript">
	initMyPage();
</script>


With LABjs becomes:

<script type="text/javascript" src="LAB.js"></script>
<script type="text/javascript">

$LAB
.script("http://remote.tld/jquery.js").wait()
.script("/local/plugin1.jquery.js")
.script("/local/plugin2.jquery.js").wait()
.script("/local/init.js").wait(function(){
	initMyPage();
});

</script>

The differences between the two snippets is that with regular <script> tags, you cannot control their loading and executing behavior reliably cross-browser. Some new browsers will load them in parallel but execute them serially, delaying execution of a smaller (quicker loading) script in the pessimistic assumption of dependency on previous scripts. Older browsers will load *and* execute them one-at-a-time, completely losing any parallel loading speed optimizations and slowing the whole process drastically.

All browsers will, however, block other page resources (like stylesheets, images, etc) while these scripts are loading, which causes the rest of the page's content loading to appear much more sluggish to the user.

LABjs by contrast will load ALL the scripts in parallel, and will execute them as soon as possible, unless you express an execution order dependency in the chain by inserting .wait(). In addition, you can "couple" inline script logic to execute in the proper order in your chain as desired by passing a function to .wait(...).

It's important to note that separare $LAB chains operate completely independently, meaning there will be no explicit waiting for execution order between them (other than the browser's first-come-first-served single execution thread processing).

There are a number of configuration options which can be specified either globally (for all $LAB chains on the page) or per chain.

For instance:

$LAB.setGlobalDefaults({AlwaysPreserveOrder:true});

would tell all $LAB chains to insert an implicit .wait() call in between each .script() call. The behavior is identical to if you just put the .wait() call in yourself.


$LAB.setOptions({AlwaysPreserveOrder:true}).script(...)...

would tell just this particular $LAB chain to do the same.


The configuration options available are:

* UseLocalXHR:true/false (default true): use XHR to preload scripts from local (same-domain) locations

* AlwaysPreserveOrder:true/false (default false): whether to insert an implicit .wait() call after each script load request... if turned on, prevents immediate execution of loaded files and instead executes all scripts in order

* AllowDuplicates:true/false (default true): whether to inspect the current page and $LAB loading cache to see if the same script URL has already been requested and allow (true) or ignore (false) if so. NOTE: in v1.2.0 and before, this didn't work correctly across multiple $LAB chains, but as of v2.0, it works correctly.

* CacheBust:true/false (default false): adds a cache-busting parameter (random number) to the end of a script URL

* BasePath:{string} (default ""): a path string to prepend to every script request's URL


Special Note: Protocol-relative URLs

Browsers have long supported "protocol-relative URLs", which basically means leaving off the "http:" or "https:" portion of a URL (leaving just the "//domain.tld/path/..." part), which causes that URL to be assumed to be the same protocol as the parent page. The benefit is that if you have a page that can be viewed in either HTTP or HTTPS, and your resources can (and need to be) served through either HTTP or HTTPS, respectively, you can simply list your URLs as protocol-relative and the browser will auto-select based on which protocol the page is viewed in.

LABjs now supports specifying such URLs to any script URL setting. NOTE: This is the recommended way to specify URLs for script resources if: a) the page you're serving can be viewed in both HTTP and HTTPS; and b) the script resource you're linking to can be accessed using the exact same domain/path with exception to the protocol. 

A common example of such a resource is the CDN locations on the Google Ajax API, where popular frameworks like jQuery and Dojo are hosted. If you are linking to such CDN resources, you are strongly encouraged to change to using protocol-relative URLs, like "//ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js" instead of "http://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js" or "https://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js".


New in v2.0:

* `AllowDuplicates` now actually works across chains. This is very important for those who want to use multiple/nested $LAB chains as part of a shared-dependency loading mechanism.

* Chains are now fully resumable, meaning you can save the return value from the last call to a chained function, and then use that saved value later as the starting point to resume the chain from where it left off. 

* Queueing is now built-in, with `queueScript`, `queueWait` and `runQueue` -- this important for those who want to build up the chain across multiple files or inline <script> elements (like in the CMS case), but want to defer starting the loading of the code starting until later (usually at the bottom of the page). 

* LABjs now supports `noConflict` (for rolling back to a previous version/copy of $LAB on the page) and `sandbox` (for creating a new pristine sandboxed copy of the current $LAB) 

* LABjs now relies on feature-testing for `async=false` and implicit/explicit "true preloading" (currently only IE, but in the spec process). Ugly/hacky "cache preloading" is now only used for "older webkit" (before March 2011 nightlies, etc), and even then, only for remote files. 

* For XHR preloading (only used in "older webkit" for local files, by default), to support better debugability, "// @sourceURL=..." is appended to the end of the code, to map the XHR/injected code to a real file name. Currently, browsers only support this for eval() (not script injection, like LABjs uses). It is hoped that browsers will soon support this annotation for their developer-tools. 

* Speaking of debugging, LABjs now supports a DEBUG mode (only if you use the source file, or if you use the LABjs-debug.min.js production file) *and* enable the "Debug" config option, which captures all the inner workings (and any errors in .wait() calls) to the browser's console.log, if present. 

* LABjs now supports a "CacheBust" config option, which will attempt to make sure all loaded scripts are forcibly loaded new on each page refresh, by auto-appending a random number parameter to each URL. ****This is really only practical/advised for DEV environments, where you want to ensure that the code reloads every time. Doing so in production would be really bad for user performance.***** 

* As part of LABjs' rewrite, the code style is now significantly improved in readability (most "minification" hacks have been removed), and it's also using more memory-savvy code, such as far fewer closures. As a result, LABjs should run leaner and faster, if only by a little bit. The goal is to get LABjs out of the way so your scripts load and run as fast as possible. 

* "AppendTo", "UsePreloading", and "UseCachePreloading" options were removed as they are no longer useful. This is the only backwards-incompatible change (no actual API changes, just config), and the change should just cause older usage code to continue to operate as normal while ignoring the no longer supported options. Still, test your code carefully if you've been using either of those 3 config options before. 

