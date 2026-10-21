package com.traceability.origintracker.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all non-API, non-static-resource requests to index.html so that
 * Angular's client-side router handles them.  Without this, refreshing a page
 * like /track/abc would return a 404 from Spring Boot.
 */
@Controller
public class SpaController {

    /**
     * Matches every path that:
     *  - does NOT start with /api/
     *  - does NOT contain a dot (i.e. is not a static file like main.js, styles.css)
     */
    @RequestMapping(value = {
            "/",
            "/{path:[^\\.]*}",
            "/{path:[^\\.]*}/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
