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

* UseCachePreload:true/false (default true): uses the mime-type cache trick (in browsers that support it) for preloading scripts from remote (cross-domain) locations

* UseLocalXHR:true/false (default true): use XHR to preload scripts from local (same-domain) locations

* UsePreloading:true/false (default true): use the cache and xhr tricks for preloading scripts in parallel

* AlwaysPreserveOrder:true/false (default false): whether to insert an implicit .wait() call after each script load request... if turned on, prevents immediate execution of loaded files and instead executes all scripts in order

* AllowDuplicates:true/false (default true): whether to inspect the current page and $LAB loading cache to see if the same script URL has already been requested and allow (true) or ignore (false) if so. NOTE: because $LAB chains are independent, may not necessarily work well across different chains if preloading is in effect.

* AppendTo:"head"/"body" (default "head"): which document element to append script elements to

* BasePath:{string} (default ""): a path string to prepend to every script request's URL
