Building Minified LABjs
=======================

The LAB.src.js file is the source file for builds. If you minify this file using Packer (without base62), or YUIC, you'll get the equivalent of LAB-debug.min.js.

To get LAB.min.js (with debug code removed), you need to first process the code in LAB.src.js. I do this manually with a simple regex-based find-n-replace, using this regular expression:

    /\/\*!START_DEBUG(?:.|[\n\r])*?END_DEBUG\*\//
	
That will remove all the debug code snippets from the source code, then pass that code through Packer or YUIC, and you'll ge the equivalent of LAB.min.js.

Final note: I manually preserve the copyright/license block comment and include it at the top of each of the two *.min.js files, since the compressors tend to remove it.

    /*! LAB.js (LABjs :: Loading And Blocking JavaScript)
        vX.Y.Z (c) Kyle Simpson
        MIT License
    */