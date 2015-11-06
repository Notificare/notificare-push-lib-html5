/*jshint camelcase: false */
/*global module:false */
module.exports = function(grunt) {

    grunt.initConfig({
        uglify: {
            options: {
                banner: '/*! Notificare <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'resources/js/notificare.jquery.js',
                dest: 'resources/js/notificare.jquery.min.js',
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');

    /*
     Default task. Compiles templates, neuters application code, and begins
     watching for changes.
     */
    grunt.registerTask('default', ['uglify']);
};