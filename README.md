


### ng-proto
This package allows you to quickly edit Angular templates/styles and see your changes immediately, without lengthy reload times. Currently, live reloading only works with css files.
For use with Angular CLI version 6+

### Install
```
npm install -g ng-proto
```

### Run
To run use the ng-proto command anywhere in your project directory, or: 
```
ng-proto ./angular_project_directory
```
The default only instant reloads css changes as I havent figured out incremental compilation for templates, but with the -s option you can mimic ng serve live reload functionality for html/ts files while instantly updating stylesheets:
```
ng-proto -s ./angular_project_directory
```


If your project is already built, you can just specify the dist directory:
```
ng-proto -d ./dist
```

Specify additional Angular CLI build options with -o: 
```
ng-proto -o --i18nFile=i18nFile
```
Your build outputs styles.css and vendor.js are used for the live reload functionality, so make sure if you build manually or change build options that your build output includes both of these files unminified. 

